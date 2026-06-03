import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseTextTransaction, parseImageTransaction, parseVoiceAudioTransaction } from '@/lib/ai/parser'

// Allow function to run up to 60s (Vercel default = 10s, kills slow voice parsing)
export const maxDuration = 60

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

async function sendConfirm(chatId: number, text: string, saveData: string): Promise<boolean> {
  if (!BOT_TOKEN) return false
  const callbackData = `save|${saveData}`
  // Telegram hard limit: callback_data must be 1–64 bytes
  if (Buffer.byteLength(callbackData, 'utf8') > 64) {
    console.error('[TG confirm] callback_data too long:', callbackData.length, callbackData)
    return false
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Save', callback_data: callbackData },
            { text: '❌ Discard', callback_data: 'discard' },
          ]]
        }
      }),
    })
    const data = await res.json() as { ok: boolean; description?: string }
    if (!data.ok) console.error('[TG confirm fail]', data.description)
    return data.ok
  } catch (e) {
    console.error('[TG confirm]', e)
    return false
  }
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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000) // 10s max
  try {
    const res = await fetch(url, { signal: controller.signal })
    const buffer = await res.arrayBuffer()
    return { base64: Buffer.from(buffer).toString('base64') }
  } finally {
    clearTimeout(timeout)
  }
}

// Encode transaction for callback_data — MUST fit in 64 bytes total
// (Telegram hard limit; exceeding it causes the sendMessage to silently fail)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function encodeTxn(txn: any): string {
  const t = txn.type[0] // 'e' | 'i' | 't'
  const a = Number(txn.amount).toFixed(2)
  // Use first 3 chars of category as a short code; full category re-derived on save
  const cat = (txn.expense_category || txn.income_category || 'oth').slice(0, 12)
  // Aggressively truncate name to 12 chars (most important info is amount + category)
  const name = (txn.merchant_name || txn.description || '').slice(0, 12).replace(/\|/g, '')
  // Date as MM-DD only — year always current
  const d = txn.transaction_date.slice(5)
  // Single char for ledger / tax
  const lt = `${(txn.ledger || 'p')[0]}${txn.is_tax_deductible ? '1' : '0'}`
  // Final shape (max ~40 bytes): save|e|5.00|grocery|Fried Chicke|06-01|p0
  return `${t}|${a}|${cat}|${name}|${d}|${lt}`
}

// Decode the compact callback data back into a transaction row
function decodeTxn(data: string): {
  type: 'expense' | 'income' | 'transfer'
  amount: number
  category: string
  name: string
  date: string
  ledger: 'personal' | 'business'
  isTax: boolean
} {
  const parts = data.split('|')
  const typeChar = parts[0] || 'e'
  const type = typeChar === 'i' ? 'income' : typeChar === 't' ? 'transfer' : 'expense'
  const amount = parseFloat(parts[1] || '0')
  const category = parts[2] || 'other_expense'
  const name = parts[3] || ''
  const mmdd = parts[4] || ''
  const year = new Date().getFullYear()
  const date = mmdd ? `${year}-${mmdd}` : new Date().toISOString().slice(0, 10)
  const lt = parts[5] || 'p0'
  const ledger = lt[0] === 'b' ? 'business' : 'personal'
  const isTax = lt[1] === '1'
  return { type, amount, category, name, date, ledger, isTax }
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
      // Answer callback immediately so the button shows feedback right away
      await answerCallback(cbId, '⏳ Saving...')

      const { data: profile } = await supabase.from('profiles').select('id').eq('telegram_id', fromId).single()
      if (!profile) {
        await editMsg(chatId, msgId, '❌ Account not linked')
        return NextResponse.json({ ok: true })
      }

      const decoded = decodeTxn(cbData.replace('save|', ''))

      const row: Record<string, unknown> = {
        user_id: profile.id,
        type: decoded.type,
        amount: decoded.amount,
        currency: 'MYR',
        description: decoded.name || null,
        merchant_name: decoded.name || null,
        transaction_date: decoded.date,
        account_name: 'Cash',
        ledger: decoded.ledger,
        is_tax_deductible: decoded.isTax,
      }
      if (decoded.type === 'expense') row.expense_category = decoded.category
      else if (decoded.type === 'income') row.income_category = decoded.category

      const { error } = await supabase.from('transactions').insert(row)
      if (error) {
        await editMsg(chatId, msgId, `❌ Save failed: ${error.message}`)
      } else {
        const sign = decoded.type === 'income' ? '+' : '-'
        await editMsg(chatId, msgId,
          `💸 *Saved!*\n\n*${decoded.name || 'Transaction'}*\n${sign}RM ${decoded.amount.toFixed(2)}\n📅 ${decoded.date}\n🏦 Cash\n\n_/undo to delete (10 min)_`
        )
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

  // ── /start [token] ───────────────────────────────────────────
  if (text.startsWith('/start')) {
    const token = text.slice(7).trim()   // everything after "/start "

    // Auto-link via deep-link token
    if (token && token.length > 10) {
      const { data: tokenRow } = await supabase
        .from('telegram_link_tokens')
        .select('user_id, expires_at')
        .eq('token', token)
        .single()

      if (!tokenRow) {
        await sendMsg(chatId, `❌ Invalid or expired link.\n\nGenerate a new one in Vinus Finance → Settings.`)
        return NextResponse.json({ ok: true })
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        await supabase.from('telegram_link_tokens').delete().eq('token', token)
        await sendMsg(chatId, `⏰ Link expired (15 min limit).\n\nGenerate a new one in Vinus Finance → Settings.`)
        return NextResponse.json({ ok: true })
      }

      // Link the account
      await supabase.from('profiles').update({ telegram_id: fromId }).eq('id', tokenRow.user_id)
      await supabase.from('telegram_link_tokens').delete().eq('token', token)

      await sendMsg(chatId,
        `✅ *Account linked!*\n\nHi *${firstName}*! Your Vinus Finance account is now connected 🎉\n\nSend me:\n• Text: \`rm15 nasi lemak\`\n• Photo: receipt 📸\n• Voice note 🎤\n\n/help for all commands`
      )
      return NextResponse.json({ ok: true })
    }

    // Normal /start (no token)
    if (profile) {
      await sendMsg(chatId,
        `👋 Welcome back *${profile.full_name ?? firstName}*!\n\nSend any transaction:\n• Text: \`rm15 nasi lemak\`\n• Photo: receipt 📸\n• Voice note 🎤\n\nCommands: /undo /report /help`
      )
    } else {
      await sendMsg(chatId,
        `👋 Hi *${firstName}*! I'm Vinus Finance bot 🤖\n\nTo link your account:\n1. Open Vinus Finance app\n2. Go to Settings → Connect Telegram\n3. Tap the button to auto-link\n\n_Or send: \`/link your@email.com\`_\n_Your Telegram ID: \`${fromId}\`_`
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
          const sent = await sendConfirm(chatId, formatPreview(txn), encodeTxn(txn))
          if (!sent) {
            // Fallback: save directly if button send failed
            await saveTxn(supabase, userId, txn)
            await sendMsg(chatId, formatSaved(txn))
          }
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
          const sent = await sendConfirm(chatId, formatPreview(txn), encodeTxn(txn))
          if (!sent) {
            // Fallback: save directly if button send failed
            await saveTxn(supabase, userId, txn)
            await sendMsg(chatId, formatSaved(txn))
          }
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
