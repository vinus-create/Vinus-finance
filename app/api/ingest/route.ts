import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseTextTransaction,
  parseImageTransaction,
  parsePDFTransaction,
  parseVoiceAudioTransaction,
  type ParsedTransaction,
} from '@/lib/ai/parser'

// ─── POST /api/ingest ─────────────────────────────────────────
// Accepts multipart/form-data with:
//   type:    'text' | 'voice' | 'image' | 'pdf'
//   content: string  (for text/voice)
//   file:    File    (for image/pdf)
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
      // New path: send audio directly to Gemini for transcription + parsing
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
      // Legacy text fallback
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

  // ─── PDF (bank statement / e-invoice) ────────────────────
  else if (type === 'pdf') {
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'file is required for pdf' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 20 MB)' }, { status: 413 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'File must be a PDF' }, { status: 400 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    parseResult = await parsePDFTransaction(base64)
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
    const bankShort = info.bank_name.split(' ')[0] // e.g. "Maybank" from "Maybank Islamic"

    let matchedId: string | null = null
    let matchedName: string | null = null

    // 1. Try matching by last 4 digits of account number
    if (last4) {
      const { data: byNum } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('account_number', last4)
        .eq('is_active', true)
        .limit(1)
      if (byNum && byNum.length > 0) {
        matchedId = byNum[0].id
        matchedName = byNum[0].name
      }
    }

    // 2. Fallback: match by institution column (first word of bank name)
    if (!matchedId && bankShort) {
      const { data: byBank } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('user_id', user.id)
        .ilike('institution', `%${bankShort}%`)
        .eq('is_active', true)
        .limit(1)
      if (byBank && byBank.length > 0) {
        matchedId = byBank[0].id
        matchedName = byBank[0].name
      }
    }

    // 3. Fallback: match by account name (catches manually-created accounts with no institution field)
    if (!matchedId && bankShort) {
      const { data: byName } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('user_id', user.id)
        .ilike('name', `%${bankShort}%`)
        .eq('is_active', true)
        .limit(1)
      if (byName && byName.length > 0) {
        matchedId = byName[0].id
        matchedName = byName[0].name
      }
    }

    if (matchedId && matchedName) {
      // Update the balance to the statement's closing balance
      if (info.closing_balance !== null) {
        await supabase
          .from('accounts')
          .update({ balance: info.closing_balance, updated_at: new Date().toISOString() })
          .eq('id', matchedId)
      }
      detectedAccount = {
        id: matchedId,
        name: matchedName,
        institution: info.bank_name,
        last4,
        closing_balance: info.closing_balance,
        was_created: false,
      }
    } else {
      // Auto-create the account
      const acctName = info.account_holder
        ? `${info.bank_name} (${info.account_holder})`
        : info.bank_name || 'Bank Account'

      const { data: newAcct } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          name: acctName,
          account_type: 'bank',
          institution: info.bank_name || null,
          account_number: last4 || null,
          balance: info.closing_balance ?? 0,
          currency: info.currency || 'MYR',
          is_active: true,
          include_in_net_worth: true,
        })
        .select('id, name')
        .single()

      if (newAcct) {
        detectedAccount = {
          id: newAcct.id,
          name: newAcct.name,
          institution: info.bank_name,
          last4,
          closing_balance: info.closing_balance,
          was_created: true,
        }
      }
    }
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
        is_tax_deductible: t.is_tax_deductible,
      }))

    const { data: inserted, error: insertError } = await supabase
      .from('transactions')
      .insert(rows)
      .select('id')

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
