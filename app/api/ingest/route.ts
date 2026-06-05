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

// ─── POST /api/ingest ─────────────────────────────────────────
// Accepts multipart/form-data with:
//   type:    'text' | 'voice' | 'image' | 'pdf' | 'investment'
//   content: string  (for text/voice)
//   file:    File    (for image/pdf/investment)
//   save:    'true'  (optional — persist to DB immediately)
//
// Returns: { success, transactions: ParsedTransaction[], source }
// ─────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

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
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'file is required for image' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 20 MB)' }, { status: 413 })
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Unsupported image type' }, { status: 400 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    parseResult = await parseImageTransaction(
      base64,
      file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    )
  }

  // ─── PDF / Statement Image (bank statement) ──────────────
  else if (type === 'pdf') {
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'file is required for pdf' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 20 MB)' }, { status: 413 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
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
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'file is required for investment' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 20 MB)' }, { status: 413 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'File must be a PDF' }, { status: 400 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const invResult = await parseInvestmentStatement(base64)
    if (!invResult.success) {
      return NextResponse.json({ success: false, error: invResult.error }, { status: 500 })
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
      source: 'investment',
    })
  }

  else {
    return NextResponse.json({ success: false, error: `Unknown type: ${type}` }, { status: 400 })
  }

  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: parseResult.error }, { status: 500 })
  }

  // ─── Account auto-detect (PDF only) ───────────────────────
  interface DetectedAccount {
    id: string
    name: string
    institution: string
    last4: string
    closing_balance: number | null
    was_created: boolean
  }

  let detectedAccount: DetectedAccount | null = null

  if (type === 'pdf' && parseResult.accountInfo) {
    const info = parseResult.accountInfo
    const last4 = info.account_number.replace(/\D/g, '').slice(-4)
    const bankShort = info.bank_name.split(' ')[0]

    let matchedId: string | null = null
    let matchedName: string | null = null

    if (last4) {
      const { data: byNum } = await supabase
        .from('accounts').select('id, name').eq('user_id', user.id)
        .eq('account_number', last4).eq('is_active', true).limit(1)
      if (byNum && byNum.length > 0) { matchedId = byNum[0].id; matchedName = byNum[0].name }
    }
    if (!matchedId && bankShort) {
      const { data: byBank } = await supabase
        .from('accounts').select('id, name').eq('user_id', user.id)
        .ilike('institution', `%${bankShort}%`).eq('is_active', true).limit(1)
      if (byBank && byBank.length > 0) { matchedId = byBank[0].id; matchedName = byBank[0].name }
    }
    if (!matchedId && bankShort) {
      const { data: byName } = await supabase
        .from('accounts').select('id, name').eq('user_id', user.id)
        .ilike('name', `%${bankShort}%`).eq('is_active', true).limit(1)
      if (byName && byName.length > 0) { matchedId = byName[0].id; matchedName = byName[0].name }
    }

    if (matchedId && matchedName) {
      if (info.closing_balance !== null) {
        await supabase.from('accounts')
          .update({ balance: info.closing_balance, updated_at: new Date().toISOString() })
          .eq('id', matchedId)
      }
      detectedAccount = { id: matchedId, name: matchedName, institution: info.bank_name, last4, closing_balance: info.closing_balance, was_created: false }
    }
    // No match found — do not auto-create; user selects account manually
  }

  // ─── Optional: save transactions to DB ────────────────────
  let savedIds: string[] = []
  if (shouldSave && parseResult.transactions.length > 0) {
    const rows = parseResult.transactions
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
        transaction_date: t.transaction_date,
        account_name: detectedAccount?.name || t.account_name,
        ledger: t.ledger,
        is_tax_deductible: t.is_tax_deductible,
      }))

    const { data: inserted, error: insertError } = await supabase
      .from('transactions').insert(rows).select('id')

    if (insertError) {
      console.error('[ingest] DB insert error:', insertError)
      return NextResponse.json(
        { success: true, transactions: parseResult.transactions, saved: false, dbError: insertError.message, detectedAccount },
        { status: 207 }
      )
    }
    savedIds = inserted?.map(r => r.id) ?? []
  }

  return NextResponse.json({
    success: true,
    transactions: parseResult.transactions,
    source: parseResult.source,
    saved: shouldSave,
    savedIds,
    detectedAccount,
  })
}
