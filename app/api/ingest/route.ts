import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseTextTransaction,
  parseImageTransaction,
  parsePDFTransaction,
  parseBankStatementImage,
  parseVoiceAudioTransaction,
  parseInvestmentStatement,
  type ParsedTransaction,
} from '@/lib/ai/parser'
import { computeDedupHash, sha256Hex } from '@/lib/utils/dedup'
import { resolveAccountName, type AccountLite } from '@/lib/utils/account-alias'
import type { CandidateAccount } from '@/lib/types/ingest.types'

// ─── POST /api/ingest ─────────────────────────────────────────
// Accepts multipart/form-data with:
//   type:    'text' | 'voice' | 'image' | 'pdf' | 'investment'
//   content: string  (for text/voice)
//   file:    File    (for image/pdf/investment)
//   save:    'true'  (optional — persist to DB immediately, legacy path)
//   force:   'true'  (optional — re-import a file that was already imported)
//
// Returns: {
//   success, source,
//   transactions,        // rows classified as NEW (default import set)
//   duplicates,          // certain duplicates (reference number match) — auto-skipped
//   suspected,           // fuzzy duplicates (no ref) — default-skipped, user-overridable
//   batchId,             // import_batches row for this upload (file types)
//   detectedAccount,     // matched existing account (pdf statements)
//   candidateAccount,    // unmatched statement account — offer auto-create
// }
// ─────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

interface ClassifiedRows {
  fresh: ParsedTransaction[]
  duplicates: ParsedTransaction[]
  suspected: ParsedTransaction[]
}

/**
 * Row-level dedup with the n-th occurrence rule: if the incoming batch has k
 * rows with an identical fingerprint and the DB already has m, only the first
 * max(0, k − m) are treated as new. This imports both of two identical
 * same-day kopitiam orders from the original statement, while skipping them
 * on an overlapping re-upload.
 */
async function classifyDuplicates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rows: ParsedTransaction[],
  effectiveAccount: (t: ParsedTransaction) => string,
): Promise<ClassifiedRows> {
  if (rows.length === 0) return { fresh: [], duplicates: [], suspected: [] }

  const hashes = rows.map(t => computeDedupHash(
    userId, effectiveAccount(t), t.transaction_date, t.type,
    t.amount, t.reference_number, t.description || null,
  ))

  const { data: existing } = await supabase
    .from('transactions')
    .select('dedup_hash')
    .eq('user_id', userId)
    .in('dedup_hash', [...new Set(hashes)])

  const dbCount = new Map<string, number>()
  for (const r of existing ?? []) {
    if (r.dedup_hash) dbCount.set(r.dedup_hash, (dbCount.get(r.dedup_hash) ?? 0) + 1)
  }

  const seenIncoming = new Map<string, number>()
  const out: ClassifiedRows = { fresh: [], duplicates: [], suspected: [] }

  rows.forEach((t, i) => {
    const h = hashes[i]
    const nth = seenIncoming.get(h) ?? 0          // 0-based occurrence within this upload
    seenIncoming.set(h, nth + 1)
    const m = dbCount.get(h) ?? 0
    if (nth >= m) {
      // occurrences beyond the DB copy count are genuinely new
      out.fresh.push(t)
    } else if (t.reference_number) {
      out.duplicates.push(t)                      // certain duplicate (ref number matched)
    } else {
      out.suspected.push(t)                       // fuzzy duplicate — user may override
    }
  })

  return out
}

export async function POST(request: NextRequest) {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 })
  }

  const type = (formData.get('type') as string) || 'text'
  const shouldSave = formData.get('save') === 'true'
  const force = formData.get('force') === 'true'

  // The user's accounts — used for alias resolution, statement matching, dedup
  const { data: accountRows } = await supabase
    .from('accounts')
    .select('id, name, institution, account_type, account_number')
    .eq('user_id', user.id)
    .eq('is_active', true)
  const accounts: AccountLite[] = (accountRows ?? []) as AccountLite[]

  // ─── File gate: reject a statement file that was already imported ─────────
  let fileBuffer: Buffer | null = null
  let fileHash: string | null = null
  let fileName: string | null = null
  const isFileType = type === 'image' || type === 'pdf' || type === 'investment'

  if (isFileType) {
    const file = formData.get('file') as File | null
    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ success: false, error: 'File too large (max 20 MB)' }, { status: 413 })
      }
      fileBuffer = Buffer.from(await file.arrayBuffer())
      fileHash = sha256Hex(fileBuffer)
      fileName = file.name || null

      if (!force) {
        const { data: dupBatch } = await supabase
          .from('import_batches')
          .select('id, file_name, created_at, inserted_rows')
          .eq('user_id', user.id)
          .eq('file_hash', fileHash)
          .eq('status', 'completed')
          .limit(1)
        if (dupBatch && dupBatch.length > 0) {
          return NextResponse.json({
            success: false,
            error: 'duplicate_file',
            duplicateBatch: dupBatch[0],
          }, { status: 409 })
        }
      }
    }
  }

  let parseResult

  // ─── Text ─────────────────────────────────────────────────
  if (type === 'text') {
    const content = formData.get('content') as string
    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: 'content is required for text' }, { status: 400 })
    }
    parseResult = await parseTextTransaction(content.trim())
  }

  // ─── Voice: audio file → Gemini audio (handles Malaysian rojak)
  else if (type === 'voice') {
    const file = formData.get('file') as File | null
    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ success: false, error: 'Audio too large (max 20 MB)' }, { status: 413 })
      }
      const validAudioTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/mpeg']
      const baseMime = file.type.split(';')[0].trim()
      if (!validAudioTypes.some(t => baseMime === t || file.type.startsWith(t))) {
        return NextResponse.json({ success: false, error: `Unsupported audio type: ${file.type}` }, { status: 400 })
      }
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      parseResult = await parseVoiceAudioTransaction(base64, baseMime)
    } else {
      const content = formData.get('content') as string
      if (!content?.trim()) {
        return NextResponse.json({ success: false, error: 'content or file is required for voice' }, { status: 400 })
      }
      parseResult = await parseTextTransaction(content.trim())
    }
  }

  // ─── Image (receipt photo / screenshot) ──────────────────
  else if (type === 'image') {
    if (!fileBuffer) {
      return NextResponse.json({ success: false, error: 'file is required for image' }, { status: 400 })
    }
    const file = formData.get('file') as File
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Unsupported image type' }, { status: 400 })
    }
    parseResult = await parseImageTransaction(
      fileBuffer.toString('base64'),
      file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    )
  }

  // ─── PDF / Statement Image (bank statement) ──────────────
  else if (type === 'pdf') {
    if (!fileBuffer) {
      return NextResponse.json({ success: false, error: 'file is required for pdf' }, { status: 400 })
    }
    const file = formData.get('file') as File
    const base64 = fileBuffer.toString('base64')
    if (file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png') {
      parseResult = await parseBankStatementImage(base64, file.type === 'image/png' ? 'image/png' : 'image/jpeg')
    } else if (file.type === 'application/pdf') {
      parseResult = await parsePDFTransaction(base64)
    } else {
      return NextResponse.json({ success: false, error: 'File must be a PDF or image (JPG/PNG)' }, { status: 400 })
    }
  }

  // ─── Investment Statement (brokerage / unit trust PDF) ────
  else if (type === 'investment') {
    if (!fileBuffer) {
      return NextResponse.json({ success: false, error: 'file is required for investment' }, { status: 400 })
    }
    const file = formData.get('file') as File
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'File must be a PDF' }, { status: 400 })
    }

    const invResult = await parseInvestmentStatement(fileBuffer.toString('base64'))
    if (!invResult.success) {
      return NextResponse.json({ success: false, error: invResult.error }, { status: 500 })
    }

    // Track this upload as an import batch
    let invBatchId: string | null = null
    {
      const { data: batch } = await supabase.from('import_batches').insert({
        user_id: user.id,
        source_type: 'investment',
        file_name: fileName,
        file_hash: fileHash,
        status: shouldSave ? 'completed' : 'pending',
        total_rows: invResult.trades.length,
        inserted_rows: shouldSave ? invResult.trades.length : 0,
      }).select('id').single()
      invBatchId = batch?.id ?? null
    }

    // Save trades to stock_trades + upsert holdings
    if (shouldSave && invResult.trades.length > 0) {
      const tradeRows = invResult.trades.map(t => ({
        user_id: user.id,
        ticker: t.ticker,
        company_name: t.company_name,
        trade_type: t.trade_type,
        shares: t.shares,
        price_per_share: t.price_per_share,
        total_amount: t.total_amount,
        fees: t.fees,
        trade_date: t.trade_date,
        notes: t.notes,
      }))
      await supabase.from('stock_trades').insert(tradeRows)

      // Recalculate holdings per ticker (weighted average cost)
      const tickers = [...new Set(invResult.trades.map(t => t.ticker))]
      for (const ticker of tickers) {
        const { data: allTrades } = await supabase
          .from('stock_trades')
          .select('trade_type, shares, price_per_share, fees')
          .eq('user_id', user.id)
          .eq('ticker', ticker)

        let totalShares = 0
        let totalCost = 0
        for (const tr of allTrades ?? []) {
          if (tr.trade_type === 'buy') {
            totalCost += tr.shares * tr.price_per_share + (tr.fees ?? 0)
            totalShares += tr.shares
          } else {
            totalShares = Math.max(0, totalShares - tr.shares)
          }
        }
        const avgCost = totalShares > 0 ? totalCost / totalShares : 0

        // Upsert holding
        const { data: existing } = await supabase
          .from('stock_holdings')
          .select('id')
          .eq('user_id', user.id)
          .eq('ticker', ticker)
          .single()

        if (existing) {
          await supabase.from('stock_holdings').update({
            shares: totalShares,
            avg_cost_price: avgCost,
            is_active: totalShares > 0,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id)
        } else if (totalShares > 0) {
          const trade = invResult.trades.find(t => t.ticker === ticker)
          await supabase.from('stock_holdings').insert({
            user_id: user.id,
            ticker,
            company_name: trade?.company_name ?? null,
            shares: totalShares,
            avg_cost_price: avgCost,
            currency: trade?.currency ?? 'USD',
            is_active: true,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      trades: invResult.trades,
      statementInfo: invResult.statementInfo,
      saved: shouldSave,
      batchId: invBatchId,
      source: 'investment',
    })
  }

  else {
    return NextResponse.json({ success: false, error: `Unknown type: ${type}` }, { status: 400 })
  }

  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: parseResult.error }, { status: 500 })
  }

  // ─── Account alias resolution (text/voice/receipt) ────────
  // "tng" / "现金" / "mbb" → the user's real account names
  if (type === 'text' || type === 'voice' || type === 'image') {
    for (const t of parseResult.transactions) {
      t.account_name = resolveAccountName(t.account_name, accounts)
      if (t.to_account_name) t.to_account_name = resolveAccountName(t.to_account_name, accounts)
    }
  }

  // ─── Account auto-detect (PDF statements) ──────────────────
  interface DetectedAccount {
    id: string
    name: string
    institution: string
    last4: string
    closing_balance: number | null
    statement_date: string | null
    was_created: boolean
  }

  let detectedAccount: DetectedAccount | null = null
  let candidateAccount: CandidateAccount | null = null

  if (type === 'pdf' && parseResult.accountInfo) {
    const info = parseResult.accountInfo
    const last4 = info.account_number.replace(/\D/g, '').slice(-4)
    const bankShort = info.bank_name.split(' ')[0]

    let matchedId: string | null = null
    let matchedName: string | null = null

    if (last4) {
      const byNum = accounts.find(a => (a as AccountLite & { account_number?: string | null }).account_number === last4)
      if (byNum) { matchedId = byNum.id; matchedName = byNum.name }
    }
    if (!matchedId && bankShort) {
      const needle = bankShort.toLowerCase()
      const byBank = accounts.find(a => (a.institution ?? '').toLowerCase().includes(needle))
        ?? accounts.find(a => a.name.toLowerCase().includes(needle))
      if (byBank) { matchedId = byBank.id; matchedName = byBank.name }
    }

    if (matchedId && matchedName) {
      // NOTE: balance is no longer updated at parse time — the save step syncs
      // closing_balance AFTER inserting rows (the balance trigger fires there).
      detectedAccount = { id: matchedId, name: matchedName, institution: info.bank_name, last4, closing_balance: info.closing_balance, statement_date: info.statement_date || null, was_created: false }
    } else if (info.bank_name) {
      // Account auto-discovery: offer to create this account on save
      candidateAccount = {
        suggested_name: info.bank_name,
        institution: info.bank_name,
        last4,
        account_type: info.account_type ?? 'bank',
        closing_balance: info.closing_balance,
        statement_date: info.statement_date || null,
      }
    }
  }

  // ─── Import batch + row-level dedup (statement uploads) ────
  let batchId: string | null = null
  let fresh: ParsedTransaction[] = parseResult.transactions
  let duplicates: ParsedTransaction[] = []
  let suspected: ParsedTransaction[] = []

  if (type === 'pdf' || type === 'image') {
    const classified = await classifyDuplicates(
      supabase, user.id, parseResult.transactions,
      t => detectedAccount?.name || t.account_name,
    )
    fresh = classified.fresh
    duplicates = classified.duplicates
    suspected = classified.suspected

    const info = type === 'pdf' ? parseResult.accountInfo : null
    const { data: batch } = await supabase.from('import_batches').insert({
      user_id: user.id,
      source_type: type,
      file_name: fileName,
      file_hash: fileHash,
      statement_period_start: info?.statement_period_start ?? null,
      statement_period_end: info?.statement_period_end ?? null,
      account_id: detectedAccount?.id ?? null,
      status: 'pending',
      total_rows: parseResult.transactions.length,
      duplicate_rows: duplicates.length + suspected.length,
    }).select('id').single()
    batchId = batch?.id ?? null
  }

  // ─── Optional: save transactions to DB (legacy immediate-save path) ───────
  let savedIds: string[] = []
  if (shouldSave && fresh.length > 0) {
    const rows = fresh
      .filter(t => t.amount > 0)
      .map((t: ParsedTransaction) => ({
        user_id: user.id,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        expense_category: t.expense_category,
        income_category: t.income_category,
        description: t.description || null,
        merchant_name: t.merchant_name || null,
        reference_number: t.reference_number,
        transaction_date: t.transaction_date,
        account_name: detectedAccount?.name || t.account_name,
        to_account_name: t.type === 'transfer' ? (t.to_account_name ?? null) : null,
        ledger: t.ledger,
        is_tax_deductible: t.is_tax_deductible,
        import_batch_id: batchId,
      }))

    const { data: inserted, error: insertError } = await supabase
      .from('transactions').insert(rows).select('id')

    if (insertError) {
      console.error('[ingest] DB insert error:', insertError)
      if (batchId) await supabase.from('import_batches').update({ status: 'failed' }).eq('id', batchId)
      return NextResponse.json(
        { success: true, transactions: fresh, duplicates, suspected, saved: false, dbError: insertError.message, detectedAccount, candidateAccount, batchId },
        { status: 207 }
      )
    }
    savedIds = inserted?.map(r => r.id) ?? []
    if (batchId) {
      await supabase.from('import_batches')
        .update({ status: 'completed', inserted_rows: savedIds.length })
        .eq('id', batchId)
    }
  }

  return NextResponse.json({
    success: true,
    transactions: fresh,
    duplicates,
    suspected,
    source: parseResult.source,
    saved: shouldSave,
    savedIds,
    batchId,
    detectedAccount,
    candidateAccount,
  })
}
