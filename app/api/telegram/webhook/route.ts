import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseTextTransaction, parseImageTransaction, parseVoiceAudioTransaction } from '@/lib/ai/parser'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// ─── Telegram API helpers ─────────────────────────────────────

async function sendMsg(chatId: number, text: string) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  }).catch(e => console.error('[TG send]', e))
}

async function sendConfirm(chatId: number, text: string, saveData: string) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Save', callback_data: `save|${saveData}` },
            { text: '❌ Discard', callback_data: 'discard' },
          ]
        ]
      }
    }),
  }).catch(e => console.error('[TG confirm]', e))
}

async function editMsg(chatId: number, msgId: number, text: string) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: msgId, text, parse_mode: 'Markdown' }),
  }).catch(() => {})
}

async function answerCallback(callbackId: string, text: string) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  }).catch(() => {})
}

async function getFile(fileId: string): Promise<string | null> {
  if (!BOT_TOKEN) return null
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
  const data = await res.json() as { ok: boolean; result?: { file_path: string } }
  if (!data.ok || !data.result?.file_path) return null
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`
}

async function downloadFile(url: string): Promise<{ base64: string }> {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  return { base64: Buffer.from(buffer).toString('base64') }
}

// Encode transaction for callback_data (max 64 bytes)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function encodeTxn(txn: any): string {
  const name = (txn.merchant_name || txn.description || '').slice(0, 20).replace(/\|/g, '')
  const cat = (txn.expense_category || txn.income_category || '').slice(0, 20)
  // format: type|amount|category|name|account|date
  return `${txn.type}|${txn.amount}|${cat}|${name}|${(txn.account_name || 'Cash').slice(0, 10)}|${txn.transaction_date}|${txn.ledger || 'personal'}|${txn.is_tax_deductible ? '1' : '0'}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatPreview(txn: any): string {
  const sign = txn.type === 'income' ? '+' : '-'
  const name = txn.merchant_name || txn.description || 'Transaction'
  const cat = txn.expense_category || txn.income_category || ''
  return `🔍 *Detected:*\n\n*${name}*\n${sign}RM ${Number(txn.amount).toFixed(2)}\n📅 ${txn.transaction_date}\n🏦 ${txn.account_name || 'Cash'}${cat ? `\n🏷️ ${cat}` : ''}\n\n_Tap ✅ to save or ❌ to discard_`
}

// ─── Main webhook handler ─────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ ok: true }) }

  const supabase = createAdminClient()

  // ── Handle inline button callbacks ──────────────────────────
  const cb = body.callback_query as Record<string, unknown> | undefined
  if (cb) {
    const cbId = cb.id as string
    const cbData = cb.data as string
    const cbMsg = cb.message as Record<string, unknown>
    const chatId = (cbMsg?.chat as Record<string, unknown>)?.id as number
    const msgId = cbMsg?.message_id as number
    const fromId = (cb.from as Record<string, unknown>)?.id as number

    if (cbData === 'discard') {
      await editMsg(chatId, msgId, '❌ *Discarded*')
      await answerCallback(cbId, 'Discarded')
      return NextResponse.json({ ok: true })
    }

    if (cbData.startsWith('save|')) {
      // Find user
      const { data: profile } = await supabase.from('profiles').select('id').eq('telegram_id', fromId).single()
      if (!profile) {
        await answerCallback(cbId, 'Account not linked')
        return NextResponse.json({ ok: true })
      }

      // Parse encoded transaction
      const parts = cbData.replace('save|', '').split('|')
      const [type, amountStr, category, name, account, date, ledger, taxStr] = parts
      const amount = parseFloat(amountStr)

      const row: Record<string, unknown> = {
        user_id: profile.id,
        type,
        amount,
        currency: 'MYR',
        description: name || null,
        merchant_name: name || null,
        transaction_date: date,
        account_name: account || 'Cash',
        ledger: ledger || 'personal',
        is_tax_deductible: taxStr === '1',
      }
      if (type === 'expense') row.expense_category = category || 'other_expense'
      else if (type === 'income') row.income_category = category || 'other_income'

      const { error } = await supabase.from('transactions').insert(row)
      if (error) {
        await editMsg(chatId, msgId, `❌ Save failed: ${error.message}`)
        await answerCallback(cbId, 'Failed')
      } else {
        const sign = type === 'income' ? '+' : '-'
        await editMsg(chatId, msgId,
          `💸 *Saved!*\n\n*${name || 'Transaction'}*\n${sign}RM ${amount.toFixed(2)}\n📅 ${date}\n🏦 ${account}\n\n_/undo to delete (10 min)_`
        )
        await answerCallback(cbId, '✅ Saved!')
      }
      return NextResponse.json({ ok: true })
    }

    await answerCallback(cbId, '')
    return NextResponse.json({ ok: true })
  }

  // ── Handle regular messages ──────────────────────────────────
  const message = (body.message ?? body.edited_message) as Record<string, unknown> | undefined
  if (!message) return NextResponse.json({ ok: true })

  const chatId = (message.chat as Record<string, unknown>)?.id as number
  const fromId = (message.from as Record<string, unknown>)?.id as number
  const firstName = (message.from as Record<string, unknown>)?.first_name as string ?? 'there'
  const text = (message.text as string ?? '').trim()

  // Look up user
  let profile: { id: string; full_name: string | null } | null = null
  try {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('telegram_id', fromId).single()
    profile = data
  } catch { /* column may not exist */ }

  // ── /start ───────────────────────────────────────────────────
  if (text.startsWith('/start')) {
    if (profile) {
      await sendMsg(chatId,
        `👋 Welcome back *${profile.full_name ?? firstName}*!\n\nSend any transaction:\n• Text: \`rm15 nasi lemak\`\n• Photo: receipt 📸\n• Voice note 🎤\n\nCommands: /undo /report /help`
      )
    } else {
      await sendMsg(chatId,
        `👋 Hi *${firstName}*! I'm Vinus Finance bot 🤖\n\n*Link your account:*\nSend: \`/link your@email.com\`\n\n_Your Telegram ID: \`${fromId}\`_`
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── /link <email> ────────────────────────────────────────────
  if (text.toLowerCase().startsWith('/link ')) {
    const email = text.slice(6).trim().toLowerCase()
    try {
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const user = (users as Array<{ id: string; email?: string }>).find(u => u.email?.toLowerCase() === email)
      if (!user) {
        await sendMsg(chatId, `❌ No account found for \`${email}\`\n\nCheck your registered email.`)
      } else {
        const { error } = await supabase.from('profiles').update({ telegram_id: fromId }).eq('id', user.id)
        if (error) {
          await sendMsg(chatId,
            `⚠️ Failed: \`${error.message}\`\n\nRun this SQL first:\n\`\`\`\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_id BIGINT;\n\`\`\``
          )
        } else {
          await sendMsg(chatId, `✅ *Linked!* Connected to \`${email}\`\n\nTry: \`rm15 nasi lemak\``)
        }
      }
    } catch (err) {
      await sendMsg(chatId, `❌ Error: ${String(err)}`)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Not linked ────────────────────────────────────────────────
  if (!profile) {
    await sendMsg(chatId, `❌ Account not linked.\n\nSend: \`/link your@email.com\`\nOr go to Settings → Telegram ID → \`${fromId}\``)
    return NextResponse.json({ ok: true })
  }

  const userId = profile.id

  try {
    // ── /undo ────────────────────────────────────────────────────
    if (text === '/undo') {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { data: last } = await supabase.from('transactions').select('id, merchant_name, description, amount, type')
        .eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(1).single()
      if (last) {
        await supabase.from('transactions').delete().eq('id', last.id)
        const name = (last.merchant_name as string | null) || (last.description as string | null) || 'transaction'
        await sendMsg(chatId, `✅ Deleted: *${name}* RM${Number(last.amount).toFixed(2)}`)
      } else {
        await sendMsg(chatId, `❌ No recent transaction to undo (10 min only).`)
      }

    // ── /report ──────────────────────────────────────────────────
    } else if (text === '/report') {
      const since = new Date(); since.setDate(since.getDate() - 7)
      const { data: txns } = await supabase.from('transactions').select('type, amount')
        .eq('user_id', userId).gte('transaction_date', since.toISOString().slice(0, 10))
      const income = (txns ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = (txns ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      const net = income - expense
      await sendMsg(chatId,
        `📊 *Last 7 days*\n\n💰 Income: RM${income.toFixed(2)}\n💸 Expenses: RM${expense.toFixed(2)}\n📈 Net: ${net >= 0 ? '+' : ''}RM${net.toFixed(2)}\n📝 ${(txns ?? []).length} transactions\n\n[View full →](https://vinus-finance.vercel.app/transactions)`
      )

    // ── /help ────────────────────────────────────────────────────
    } else if (text === '/help') {
      await sendMsg(chatId,
        `🤖 *Vinus Finance Bot*\n\n*Log transactions:*\n• Text: \`rm15 nasi lemak\`\n• Text: \`rm4500 gaji\`\n• Photo: send receipt 📸\n• Voice: send voice note 🎤\n\n*Commands:*\n/undo — delete last (10 min)\n/report — 7-day summary\n/help — this message`
      )

    // ── Text → parse + confirm ───────────────────────────────────
    } else if (text && !text.startsWith('/')) {
      const result = await parseTextTransaction(text)
      if (!result.success || result.transactions.length === 0) {
        await sendMsg(chatId, `❓ Couldn't parse. Try:\n\`rm15 nasi lemak\`\n\`rm4500 salary\``)
      } else {
        const txn = result.transactions[0]
        // Text is usually accurate — auto-save directly
        await saveTxn(supabase, userId, txn)
        await sendMsg(chatId, formatSaved(txn))
      }

    // ── Photo → confirm before saving ───────────────────────────
    } else if (message.photo) {
      await sendMsg(chatId, '📸 Processing receipt...')
      try {
        const photos = message.photo as Array<{ file_id: string; file_size?: number }>
        const largest = photos.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0]
        const fileUrl = await getFile(largest.file_id)
        if (!fileUrl) throw new Error('Could not get file')
        const { base64 } = await downloadFile(fileUrl)
        const result = await parseImageTransaction(base64, 'image/jpeg')
        if (result.success && result.transactions.length > 0) {
          const txn = result.transactions[0]
          await sendConfirm(chatId, formatPreview(txn), encodeTxn(txn))
        } else {
          await sendMsg(chatId, `📸 Couldn't read receipt. Try a clearer photo.`)
        }
      } catch (err) {
        console.error('[TG photo]', err)
        await sendMsg(chatId, `📸 Photo processing failed. Please try again.`)
      }

    // ── Voice → confirm before saving ───────────────────────────
    } else if (message.voice || message.audio) {
      await sendMsg(chatId, '🎤 Processing voice note...')
      try {
        const audio = (message.voice ?? message.audio) as Record<string, unknown>
        const fileUrl = await getFile(audio.file_id as string)
        if (!fileUrl) throw new Error('Could not get audio file')
        const { base64 } = await downloadFile(fileUrl)
        const result = await parseVoiceAudioTransaction(base64, 'audio/ogg')
        if (result.success && result.transactions.length > 0) {
          const txn = result.transactions[0]
          await sendConfirm(chatId, formatPreview(txn), encodeTxn(txn))
        } else {
          await sendMsg(chatId, `🎤 Couldn't understand. Try typing instead.`)
        }
      } catch (err) {
        console.error('[TG voice]', err)
        await sendMsg(chatId, `🎤 Voice processing failed. Please try typing instead.`)
      }

    } else {
      await sendMsg(chatId, `Send a transaction, photo, or voice note.\n/help for all commands.`)
    }

  } catch (err) {
    console.error('[TG main]', err)
    await sendMsg(chatId, '⚠️ Something went wrong. Please try again.')
  }

  return NextResponse.json({ ok: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveTxn(supabase: any, userId: string, txn: any) {
  const { error } = await supabase.from('transactions').insert({
    user_id: userId, type: txn.type, amount: txn.amount, currency: txn.currency,
    expense_category: txn.expense_category, income_category: txn.income_category,
    description: txn.description || null, merchant_name: txn.merchant_name || null,
    transaction_date: txn.transaction_date, account_name: txn.account_name || 'Cash',
    ledger: txn.ledger || 'personal', is_tax_deductible: txn.is_tax_deductible,
  })
  if (error) console.error('[TG saveTxn]', error)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatSaved(txn: any): string {
  const sign = txn.type === 'income' ? '+' : '-'
  const name = txn.merchant_name || txn.description || 'Transaction'
  return `💸 *Saved!*\n\n*${name}*\n${sign}RM ${Number(txn.amount).toFixed(2)}\n📅 ${txn.transaction_date}\n🏦 ${txn.account_name || 'Cash'}\n\n_/undo to delete (10 min)_`
}
