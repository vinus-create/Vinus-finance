import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseTextTransaction, parseImageTransaction, parseVoiceAudioTransaction } from '@/lib/ai/parser'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'vinus-finance-verify'
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN

// ─── GET: Meta webhook verification ──────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ─── POST: Incoming messages ──────────────────────────────────
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ status: 'ok' }) }

  const entry = (body.entry as unknown[])?.[0] as Record<string, unknown>
  const changes = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
  const value = changes?.value as Record<string, unknown>
  const messages = value?.messages as Record<string, unknown>[] | undefined

  // Acknowledge status updates immediately (no message content)
  if (!messages || messages.length === 0) {
    return NextResponse.json({ status: 'ok' })
  }

  const message = messages[0]
  const from = message.from as string
  const msgType = message.type as string

  const supabase = await createClient()

  // ── Look up user by phone number ───────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('phone_number', from)
    .single()

  if (!profile) {
    await send(from,
      `👋 Hi! Your number *${from}* isn't linked to Vinus Finance.\n\n` +
      `To link it:\n1. Open Vinus Finance\n2. Go to ⚙️ Settings\n3. Enter your phone number: *${from}*\n\n` +
      `Then send any message here to log a transaction!`
    )
    return NextResponse.json({ status: 'ok' })
  }

  const userId = profile.id
  const firstName = (profile.full_name as string | null)?.split(' ')[0] ?? 'there'
  let reply = ''

  try {
    const text = msgType === 'text' ? (message.text as Record<string, string>)?.body?.trim() ?? '' : ''
    const upperText = text.toUpperCase().trim()

    // ── UNDO: delete last transaction (within 10 min) ────────
    if (upperText === 'UNDO' || upperText === 'CANCEL') {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { data: last } = await supabase
        .from('transactions')
        .select('id, merchant_name, description, amount, type')
        .eq('user_id', userId)
        .gte('created_at', tenMinAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (last) {
        await supabase.from('transactions').delete().eq('id', last.id)
        const name = (last.merchant_name as string | null) || (last.description as string | null) || 'transaction'
        reply = `✅ Deleted: *${name}* RM${Number(last.amount).toFixed(2)}`
      } else {
        reply = `❌ No recent transaction to undo (only works within 10 minutes).`
      }

    // ── HELP command ─────────────────────────────────────────
    } else if (upperText === 'HELP' || upperText === '?') {
      reply = `🤖 *Vinus Finance Bot* — Hi ${firstName}!\n\n` +
        `*How to log transactions:*\n` +
        `• Text: "rm15 nasi lemak lunch"\n` +
        `• Text: "rm4500 gaji"\n` +
        `• Text: "RM50 Grab Food"\n` +
        `• Photo: send a receipt image 📸\n` +
        `• Voice: send a voice note 🎤\n\n` +
        `*Commands:*\n` +
        `• UNDO — delete last transaction (10 min)\n` +
        `• REPORT — this week's summary\n` +
        `• HELP — show this message`

    // ── REPORT: weekly summary ────────────────────────────────
    } else if (upperText === 'REPORT' || upperText === 'SUMMARY') {
      const since = new Date()
      since.setDate(since.getDate() - 7)
      const sinceStr = since.toISOString().slice(0, 10)
      const { data: txns } = await supabase
        .from('transactions')
        .select('type, amount, expense_category, merchant_name')
        .eq('user_id', userId)
        .gte('transaction_date', sinceStr)
      const income = (txns ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = (txns ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      reply = `📊 *Last 7 days — ${firstName}*\n\n` +
        `💰 Income: RM${income.toFixed(2)}\n` +
        `💸 Expenses: RM${expense.toFixed(2)}\n` +
        `📈 Net: RM${(income - expense).toFixed(2)}\n` +
        `📝 ${(txns ?? []).length} transactions\n\n` +
        `Full details: vinus-finance.vercel.app`

    // ── Text message → parse transaction ─────────────────────
    } else if (msgType === 'text' && text) {
      const result = await parseTextTransaction(text)
      if (!result.success || result.transactions.length === 0) {
        reply = `❓ Couldn't parse that.\n\nTry:\n• "rm15 nasi lemak"\n• "rm4500 salary"\n• Send HELP for more`
      } else {
        const txn = result.transactions[0]
        const saved = await saveTxn(supabase, userId, txn)
        reply = formatConfirmation(txn, saved?.id)
      }

    // ── Image → parse receipt ────────────────────────────────
    } else if (msgType === 'image') {
      const imageId = (message.image as Record<string, string>)?.id
      if (imageId) {
        const mediaUrl = await getMediaUrl(imageId)
        if (mediaUrl) {
          const { base64, mimeType } = await downloadMedia(mediaUrl)
          const result = await parseImageTransaction(base64, mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
          if (result.success && result.transactions.length > 0) {
            const txn = result.transactions[0]
            const saved = await saveTxn(supabase, userId, txn)
            reply = formatConfirmation(txn, saved?.id)
          } else {
            reply = `📸 Couldn't read this receipt. Please send a clearer photo.`
          }
        } else {
          reply = `❌ Failed to download image. Please try again.`
        }
      }

    // ── Audio / Voice note → transcribe + parse ──────────────
    } else if (msgType === 'audio') {
      const audioId = (message.audio as Record<string, string>)?.id
      if (audioId) {
        await send(from, `🎤 Processing your voice note...`)
        const mediaUrl = await getMediaUrl(audioId)
        if (mediaUrl) {
          const { base64, mimeType } = await downloadMedia(mediaUrl)
          const result = await parseVoiceAudioTransaction(base64, mimeType || 'audio/ogg')
          if (result.success && result.transactions.length > 0) {
            const txn = result.transactions[0]
            const saved = await saveTxn(supabase, userId, txn)
            reply = formatConfirmation(txn, saved?.id)
          } else {
            reply = `🎤 Couldn't understand the voice note. Please try again or type it instead.`
          }
        }
      }

    } else {
      reply = `✅ Hi ${firstName}! Send me:\n• Text: "rm15 lunch"\n• Photo: receipt 📸\n• Voice note 🎤\n• HELP for more`
    }

  } catch (err) {
    console.error('[WhatsApp] Error:', err)
    reply = '⚠️ Something went wrong. Please try again.'
  }

  if (reply) await send(from, reply)
  return NextResponse.json({ status: 'ok' })
}

// ─── Helpers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveTxn(supabase: any, userId: string, txn: any) {
  const { data } = await supabase.from('transactions').insert({
    user_id: userId,
    type: txn.type,
    amount: txn.amount,
    currency: txn.currency,
    expense_category: txn.expense_category,
    income_category: txn.income_category,
    description: txn.description || null,
    merchant_name: txn.merchant_name || null,
    transaction_date: txn.transaction_date,
    account_name: txn.account_name || 'Cash',
    ledger: txn.ledger || 'personal',
    is_tax_deductible: txn.is_tax_deductible,
  }).select('id').single()
  return data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatConfirmation(txn: any, id?: string): string {
  const sign = txn.type === 'income' ? '+' : '-'
  const emoji = txn.type === 'income' ? '💰' : txn.type === 'transfer' ? '🔄' : '💸'
  const name = txn.merchant_name || txn.description || 'Transaction'
  return `${emoji} *Saved!*\n\n` +
    `*${name}*\n` +
    `${sign}RM ${txn.amount.toFixed(2)}\n` +
    `📅 ${txn.transaction_date}\n` +
    `🏦 ${txn.account_name || 'Cash'}\n\n` +
    `_Reply *UNDO* to delete (10 min)_`
}

async function send(to: string, text: string) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  })
}

async function getMediaUrl(mediaId: string): Promise<string | null> {
  if (!ACCESS_TOKEN) return null
  const res = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  })
  const data = await res.json() as Record<string, unknown>
  return (data.url as string) ?? null
}

async function downloadMedia(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } })
  const mimeType = res.headers.get('content-type')?.split(';')[0].trim() || 'image/jpeg'
  const buffer = await res.arrayBuffer()
  return { base64: Buffer.from(buffer).toString('base64'), mimeType }
}
