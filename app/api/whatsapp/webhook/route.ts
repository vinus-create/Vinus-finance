import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseTextTransaction, parseImageTransaction } from '@/lib/ai/parser'

// ─── WhatsApp Cloud API Webhook ───────────────────────────────
// Setup:
//   1. Create a Meta App at developers.facebook.com
//   2. Add WhatsApp product, get Phone Number ID and Access Token
//   3. Set env vars: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
//   4. Set webhook URL to: https://your-app.vercel.app/api/whatsapp/webhook
//   5. Verify token: set WHATSAPP_VERIFY_TOKEN to any string you choose
//
// Flow: User sends message to your WhatsApp number
//       → Meta sends webhook POST to this route
//       → We parse the transaction
//       → Auto-save to DB
//       → Reply with confirmation
// ─────────────────────────────────────────────────────────────

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'vinus-finance-verify'
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN

// ─── GET: Webhook verification ────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified')
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ─── POST: Incoming messages ──────────────────────────────────
export async function POST(request: NextRequest) {
  const body = await request.json()

  // Extract message from Meta webhook payload
  const entry = body.entry?.[0]
  const changes = entry?.changes?.[0]
  const value = changes?.value
  const messages = value?.messages

  if (!messages || messages.length === 0) {
    // Could be a status update, not a message — acknowledge and ignore
    return NextResponse.json({ status: 'ok' })
  }

  const message = messages[0]
  const from = message.from // sender's WhatsApp number e.g. "60123456789"
  const msgType = message.type // 'text' | 'image' | 'document'

  // ── Look up user by phone number ──────────────────────────
  // Store phone numbers in profiles.phone_number column (with country code, no +)
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone_number', from)
    .single()

  if (!profile) {
    // User not registered — send help message
    await sendWhatsAppMessage(from,
      `👋 Hi! Your number isn't linked to a Vinus Finance account.\n\n` +
      `To link your WhatsApp:\n` +
      `1. Open Vinus Finance app\n` +
      `2. Go to Settings → WhatsApp Bot\n` +
      `3. Enter your phone number: ${from}`
    )
    return NextResponse.json({ status: 'ok' })
  }

  const userId = profile.id
  let reply = ''

  try {
    if (msgType === 'text') {
      // ── Parse text message as transaction ─────────────────
      const text = message.text?.body?.trim()
      if (!text) return NextResponse.json({ status: 'ok' })

      const result = await parseTextTransaction(text)
      if (!result.success || result.transactions.length === 0) {
        reply = `❓ Couldn't understand that. Try:\n"RM15 nasi lemak lunch"\n"rm50 grab food"\n"RM4500 salary"`
      } else {
        const txn = result.transactions[0]
        const savedTxn = await saveTxn(supabase, userId, txn)
        reply = formatConfirmation(txn, savedTxn?.id)
      }

    } else if (msgType === 'image') {
      // ── Download image and parse as receipt ───────────────
      const imageId = message.image?.id
      if (!imageId) return NextResponse.json({ status: 'ok' })

      const mediaUrl = await getMediaUrl(imageId)
      if (!mediaUrl) {
        reply = '❌ Could not download image. Please try again.'
      } else {
        const { base64, mimeType } = await downloadMedia(mediaUrl)
        const result = await parseImageTransaction(base64, mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
        if (!result.success || result.transactions.length === 0) {
          reply = "📸 Couldn't read the receipt. Try sending a clearer photo."
        } else {
          const txn = result.transactions[0]
          const savedTxn = await saveTxn(supabase, userId, txn)
          reply = formatConfirmation(txn, savedTxn?.id)
        }
      }

    } else {
      reply = `✅ Received! I can process:\n• *Text*: "rm15 lunch mamak"\n• *Images*: receipt photos`
    }
  } catch (err) {
    console.error('[WhatsApp] Error:', err)
    reply = '⚠️ Something went wrong. Please try again.'
  }

  await sendWhatsAppMessage(from, reply)
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
  return `${emoji} Saved!\n\n*${name}*\n${sign}RM ${txn.amount.toFixed(2)} · ${txn.transaction_date}\nAccount: ${txn.account_name || 'Cash'}\n\nReply *UNDO* to delete${id ? ` (ID: ${id.slice(0, 8)})` : ''}`
}

async function sendWhatsAppMessage(to: string, text: string) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.warn('[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN env vars')
    return
  }
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}

async function getMediaUrl(mediaId: string): Promise<string | null> {
  if (!ACCESS_TOKEN) return null
  const res = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  })
  const data = await res.json()
  return data.url ?? null
}

async function downloadMedia(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  })
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buffer = await res.arrayBuffer()
  return {
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: contentType.split(';')[0].trim(),
  }
}
