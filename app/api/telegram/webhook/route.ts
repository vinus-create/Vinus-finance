import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseTextTransaction, parseImageTransaction, parseVoiceAudioTransaction } from '@/lib/ai/parser'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

async function sendMsg(chatId: number, text: string, parseMode = 'Markdown') {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  })
}

async function getFile(fileId: string): Promise<string | null> {
  if (!BOT_TOKEN) return null
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
  const data = await res.json() as { ok: boolean; result?: { file_path: string } }
  if (!data.ok || !data.result?.file_path) return null
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`
}

async function downloadFile(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url)
  const mimeType = res.headers.get('content-type')?.split(';')[0].trim() || 'image/jpeg'
  const buffer = await res.arrayBuffer()
  return { base64: Buffer.from(buffer).toString('base64'), mimeType }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ ok: true }) }

  const message = (body.message ?? body.edited_message) as Record<string, unknown> | undefined
  if (!message) return NextResponse.json({ ok: true })

  const chatId = (message.chat as Record<string, unknown>)?.id as number
  const fromId = (message.from as Record<string, unknown>)?.id as number
  const firstName = (message.from as Record<string, unknown>)?.first_name as string ?? 'there'
  const text = (message.text as string ?? '').trim()
  const upperText = text.toUpperCase()

  const supabase = await createClient()

  // ── Look up user by telegram_id ──────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_id', fromId)
    .single()

  // ── /start — always respond, show link instructions ──────
  if (text.startsWith('/start')) {
    if (profile) {
      await sendMsg(chatId,
        `👋 Welcome back *${(profile.full_name as string | null) ?? firstName}*!\n\n` +
        `Send me any transaction:\n` +
        `• Text: \`rm15 nasi lemak\`\n` +
        `• Photo: receipt 📸\n` +
        `• Voice note 🎤\n\n` +
        `Commands: /undo /report /help`
      )
    } else {
      await sendMsg(chatId,
        `👋 Hi *${firstName}*! I'm your Vinus Finance bot 🤖\n\n` +
        `To link your account:\n` +
        `1. Open Vinus Finance app\n` +
        `2. Go to ⚙️ *Settings*\n` +
        `3. Enter your Telegram ID: \`${fromId}\`\n\n` +
        `_Your Telegram ID is: \`${fromId}\`_`
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Not linked — ask to link ─────────────────────────────
  if (!profile) {
    await sendMsg(chatId,
      `❌ Your Telegram account isn't linked yet.\n\n` +
      `1. Open Vinus Finance app\n` +
      `2. Settings → Telegram ID → enter \`${fromId}\`\n` +
      `3. Save and come back here`
    )
    return NextResponse.json({ ok: true })
  }

  const userId = profile.id
  let reply = ''

  try {
    // ── /undo — delete last transaction (10 min) ─────────
    if (upperText === '/UNDO' || text === '/undo') {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { data: last } = await supabase
        .from('transactions').select('id, merchant_name, description, amount, type')
        .eq('user_id', userId).gte('created_at', since)
        .order('created_at', { ascending: false }).limit(1).single()
      if (last) {
        await supabase.from('transactions').delete().eq('id', last.id)
        const name = (last.merchant_name as string | null) || (last.description as string | null) || 'transaction'
        reply = `✅ Deleted: *${name}* RM${Number(last.amount).toFixed(2)}`
      } else {
        reply = `❌ No recent transaction to undo (only works within 10 minutes).`
      }

    // ── /report — 7 day summary ──────────────────────────
    } else if (text === '/report' || upperText === '/REPORT') {
      const since = new Date(); since.setDate(since.getDate() - 7)
      const sinceStr = since.toISOString().slice(0, 10)
      const { data: txns } = await supabase
        .from('transactions').select('type, amount, expense_category')
        .eq('user_id', userId).gte('transaction_date', sinceStr)
      const income = (txns ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = (txns ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      const net = income - expense
      reply = `📊 *Last 7 days*\n\n` +
        `💰 Income: RM${income.toFixed(2)}\n` +
        `💸 Expenses: RM${expense.toFixed(2)}\n` +
        `📈 Net: ${net >= 0 ? '+' : ''}RM${net.toFixed(2)}\n` +
        `📝 ${(txns ?? []).length} transactions\n\n` +
        `[View full report](https://vinus-finance.vercel.app/transactions)`

    // ── /help ────────────────────────────────────────────
    } else if (text === '/help' || upperText === '/HELP') {
      reply = `🤖 *Vinus Finance Bot*\n\n` +
        `*Log a transaction:*\n` +
        `• Text: \`rm15 nasi lemak\`\n` +
        `• Text: \`rm4500 gaji\`\n` +
        `• Photo: send a receipt 📸\n` +
        `• Voice: send a voice note 🎤\n\n` +
        `*Commands:*\n` +
        `/undo — delete last transaction\n` +
        `/report — 7-day summary\n` +
        `/help — this message`

    // ── Text message → parse transaction ─────────────────
    } else if (text && !text.startsWith('/')) {
      const result = await parseTextTransaction(text)
      if (!result.success || result.transactions.length === 0) {
        reply = `❓ Couldn't parse that. Try:\n\`rm15 nasi lemak\`\n\`rm4500 salary\`\n/help for more`
      } else {
        const txn = result.transactions[0]
        await saveTxn(supabase, userId, txn)
        reply = formatConfirmation(txn)
      }

    // ── Photo → parse receipt ────────────────────────────
    } else if (message.photo) {
      const photos = message.photo as Array<{ file_id: string; file_size: number }>
      const largest = photos.sort((a, b) => b.file_size - a.file_size)[0]
      const fileUrl = await getFile(largest.file_id)
      if (fileUrl) {
        await sendMsg(chatId, '📸 Processing receipt...')
        const { base64, mimeType } = await downloadFile(fileUrl)
        const result = await parseImageTransaction(base64, mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
        if (result.success && result.transactions.length > 0) {
          const txn = result.transactions[0]
          await saveTxn(supabase, userId, txn)
          reply = formatConfirmation(txn)
        } else {
          reply = `📸 Couldn't read receipt. Please send a clearer photo.`
        }
      }

    // ── Voice / Audio → transcribe + parse ──────────────
    } else if (message.voice || message.audio) {
      const audio = (message.voice ?? message.audio) as Record<string, unknown>
      const fileUrl = await getFile(audio.file_id as string)
      if (fileUrl) {
        await sendMsg(chatId, '🎤 Processing voice note...')
        const { base64, mimeType } = await downloadFile(fileUrl)
        const result = await parseVoiceAudioTransaction(base64, mimeType || 'audio/ogg')
        if (result.success && result.transactions.length > 0) {
          const txn = result.transactions[0]
          await saveTxn(supabase, userId, txn)
          reply = formatConfirmation(txn)
        } else {
          reply = `🎤 Couldn't understand. Try typing it instead.`
        }
      }
    }

  } catch (err) {
    console.error('[Telegram]', err)
    reply = '⚠️ Something went wrong. Please try again.'
  }

  if (reply) await sendMsg(chatId, reply)
  return NextResponse.json({ ok: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveTxn(supabase: any, userId: string, txn: any) {
  await supabase.from('transactions').insert({
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
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatConfirmation(txn: any): string {
  const sign = txn.type === 'income' ? '+' : '-'
  const emoji = txn.type === 'income' ? '💰' : txn.type === 'transfer' ? '🔄' : '💸'
  const name = txn.merchant_name || txn.description || 'Transaction'
  return `${emoji} *Saved!*\n\n` +
    `*${name}*\n` +
    `${sign}RM ${txn.amount.toFixed(2)}\n` +
    `📅 ${txn.transaction_date}\n` +
    `🏦 ${txn.account_name || 'Cash'}\n\n` +
    `_Reply /undo to delete (10 min)_`
}
