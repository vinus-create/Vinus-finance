import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildWeeklyDigestPrompt } from '@/lib/ai/prompts'
import { getFlashModel } from '@/lib/ai/gemini'

// POST /api/digest — generate AI spending roast for the last 7 days
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch last 7 days of transactions
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceStr = since.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })

  const { data: txns } = await supabase
    .from('transactions')
    .select('type, amount, expense_category, income_category, merchant_name, description, transaction_date, ledger')
    .eq('user_id', user.id)
    .gte('transaction_date', sinceStr)
    .order('transaction_date', { ascending: false })
    .limit(100)

  const transactions = txns ?? []
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  // Find top expense category
  const catSpend: Record<string, number> = {}
  for (const txn of transactions) {
    if (txn.type === 'expense' && txn.expense_category) {
      catSpend[txn.expense_category] = (catSpend[txn.expense_category] ?? 0) + Number(txn.amount)
    }
  }
  const topEntry = Object.entries(catSpend).sort(([, a], [, b]) => b - a)[0]
  const topCategory = topEntry?.[0] ?? null
  const topCategoryAmount = topEntry?.[1] ?? 0

  try {
    const model = getFlashModel()
    // Override response mime type for plain text
    const genModel = model
    const prompt = buildWeeklyDigestPrompt(transactions, totalIncome, totalExpense, topCategory, topCategoryAmount)
    const result = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'text/plain', temperature: 0.85 },
    })
    const digest = result.response.text().trim()
    return NextResponse.json({ success: true, digest, stats: { totalIncome, totalExpense, txnCount: transactions.length } })
  } catch (err) {
    console.error('[digest]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
