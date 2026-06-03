import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFlashModel } from '@/lib/ai/gemini'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ tip: null }, { status: 400 })

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(year, month, 0).getDate()
    const start = `${year}-${mm}-01`
    const end = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

    // Fetch context in parallel
    const [txnsRes, budgetsRes, remindersRes, loansRes] = await Promise.all([
      supabase.from('transactions').select('type, amount, expense_category, merchant_name, transaction_date')
        .eq('user_id', userId).gte('transaction_date', start).lte('transaction_date', end).order('transaction_date', { ascending: false }).limit(20),
      supabase.from('budgets').select('expense_category, budget_amount')
        .eq('user_id', userId).eq('period_year', year).eq('period_month', month),
      supabase.from('reminders').select('title, amount, due_date')
        .eq('user_id', userId).eq('status', 'active')
        .gte('due_date', now.toISOString().slice(0, 10))
        .lte('due_date', new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)),
      supabase.from('loans').select('name, monthly_payment, outstanding_balance')
        .eq('user_id', userId).eq('is_active', true).gt('outstanding_balance', 0),
    ])

    const txns = txnsRes.data ?? []
    const budgets = budgetsRes.data ?? []
    const reminders = remindersRes.data ?? []
    const loans = loansRes.data ?? []

    const totalExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const totalIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const totalBudget = budgets.reduce((s, b) => s + Number(b.budget_amount), 0)
    const totalLoanMonthly = loans.reduce((s, l) => s + Number(l.monthly_payment), 0)

    const context = `
用户本月（${year}年${month}月）财务状况：
- 收入：RM ${totalIncome.toFixed(2)}
- 支出：RM ${totalExpense.toFixed(2)}
- 月度预算：RM ${totalBudget > 0 ? totalBudget.toFixed(2) : '未设定'}
- 贷款月供：RM ${totalLoanMonthly.toFixed(2)}（${loans.length} 笔贷款）
- 未来7天到期提醒：${reminders.length > 0 ? reminders.map(r => `${r.title} RM${Number(r.amount ?? 0).toFixed(2)} (${r.due_date})`).join('；') : '无'}
- 本月最近交易：${txns.slice(0, 5).map(t => `${t.merchant_name ?? t.expense_category} -RM${Number(t.amount).toFixed(2)}`).join('；')}
`.trim()

    function cleanTip(raw: string): string {
      let text = raw.trim()
      // Strip markdown code blocks
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
      // If it looks like JSON, extract the text value
      if (text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text)
          // Try common keys
          text = parsed.tip ?? parsed.advice ?? parsed.message ?? parsed.content ?? text
        } catch {
          // Remove JSON-like wrapping manually
          text = text.replace(/^\{\s*"[^"]+"\s*:\s*"/, '').replace(/"\s*\}$/, '').trim()
        }
      }
      return text
    }

    const model = getFlashModel()
    const result = await model.generateContent(
      `你是马来西亚个人理财助手 Vinus Finance。请做以下两件事：

1. 根据用户的财务数据，用中文给出一句具体、有针对性的理财建议（30-50字，结合用户实际情况，不要泛泛而谈）。

2. 引用一位世界著名投资家/企业家的理财名言（巴菲特、芒格、彼得林奇、瑞·达利欧、罗伯特·清崎等），附上人名，并用一句话说明与用户当前状况的关联（20-30字）。

格式：
💡 [个人化建议]

📖 "[名言原文]" —— [人名]
→ [与用户现状的关联]

用户财务数据：
${context}`
    )
    const tip = cleanTip(result.response.text())

    return NextResponse.json({ tip }, {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    })
  } catch (err) {
    console.error('[AI daily tip]', err)
    return NextResponse.json({ tip: null })
  }
}
