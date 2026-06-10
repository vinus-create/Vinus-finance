import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFlashModel } from '@/lib/ai/gemini'

export const maxDuration = 45

function calcAge(dob: string): number {
  const d = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  if (today.getMonth() - d.getMonth() < 0 ||
    (today.getMonth() - d.getMonth() === 0 && today.getDate() < d.getDate())) age--
  return age
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all needed data in parallel
  const since6m = new Date()
  since6m.setMonth(since6m.getMonth() - 6)
  const since6mStr = since6m.toISOString().slice(0, 10)

  const [profileRes, txnsRes, accountsRes, loansRes, goalsRes, epfRes] = await Promise.all([
    supabase.from('profiles').select('full_name, date_of_birth').eq('id', user.id).single(),
    supabase.from('transactions')
      .select('type, amount, expense_category, income_category, transaction_date, ledger')
      .eq('user_id', user.id).gte('transaction_date', since6mStr)
      .eq('ledger', 'personal').order('transaction_date', { ascending: false }).limit(500),
    supabase.from('accounts').select('balance, account_type, include_in_net_worth').eq('user_id', user.id).eq('is_active', true),
    supabase.from('loans').select('outstanding_balance, monthly_payment, loan_type').eq('user_id', user.id).eq('is_active', true),
    supabase.from('savings_goals').select('target_amount, current_amount, is_completed').eq('user_id', user.id),
    supabase.from('stock_holdings').select('shares').eq('user_id', user.id).eq('ticker', 'KWSP-EPF').maybeSingle(),
  ])

  const profile = profileRes.data
  const txns = txnsRes.data ?? []
  const accounts = accountsRes.data ?? []
  const loans = loansRes.data ?? []
  const goals = goalsRes.data ?? []
  const epfBalance = Number(epfRes.data?.shares ?? 0)

  const dob = (profile as { date_of_birth?: string | null } | null)?.date_of_birth
  const name = profile?.full_name ?? '用户'
  const age = dob ? calcAge(dob) : null

  // ── Financial calculations ──────────────────────────────────
  // Monthly averages (last 6 months)
  const incomeMonths = new Map<string, number>()
  const expenseMonths = new Map<string, number>()
  for (const txn of txns) {
    const month = txn.transaction_date.slice(0, 7)
    if (txn.type === 'income') incomeMonths.set(month, (incomeMonths.get(month) ?? 0) + Number(txn.amount))
    if (txn.type === 'expense') expenseMonths.set(month, (expenseMonths.get(month) ?? 0) + Number(txn.amount))
  }
  const avgMonthlyIncome = incomeMonths.size > 0
    ? Array.from(incomeMonths.values()).reduce((a, b) => a + b, 0) / incomeMonths.size : 0
  const avgMonthlyExpense = expenseMonths.size > 0
    ? Array.from(expenseMonths.values()).reduce((a, b) => a + b, 0) / expenseMonths.size : 0
  const savingsRate = avgMonthlyIncome > 0
    ? Math.round(((avgMonthlyIncome - avgMonthlyExpense) / avgMonthlyIncome) * 100) : 0

  // Net worth
  const totalAssets = accounts
    .filter(a => a.include_in_net_worth && a.account_type !== 'credit_card')
    .reduce((s, a) => s + Number(a.balance), 0) + epfBalance
  const totalDebt = loans.reduce((s, l) => s + Number(l.outstanding_balance), 0)
    + accounts.filter(a => a.account_type === 'credit_card' && Number(a.balance) < 0)
      .reduce((s, a) => s + Math.abs(Number(a.balance)), 0)
  const netWorth = totalAssets - totalDebt
  const totalLoanMonthly = loans.reduce((s, l) => s + Number(l.monthly_payment), 0)
  const debtServiceRatio = avgMonthlyIncome > 0
    ? Math.round((totalLoanMonthly / avgMonthlyIncome) * 100) : 0

  // Top spending categories
  const catSpend: Record<string, number> = {}
  for (const txn of txns) {
    if (txn.type === 'expense' && txn.expense_category)
      catSpend[txn.expense_category] = (catSpend[txn.expense_category] ?? 0) + Number(txn.amount)
  }
  const topCats = Object.entries(catSpend).sort(([, a], [, b]) => b - a).slice(0, 3)
    .map(([cat, amt]) => `${cat}: RM${amt.toFixed(0)}/6个月`)

  // Savings goals summary
  const activeGoals = goals.filter(g => !g.is_completed)
  const totalGoalTarget = activeGoals.reduce((s, g) => s + Number(g.target_amount), 0)
  const totalGoalSaved = activeGoals.reduce((s, g) => s + Number(g.current_amount), 0)

  const prompt = `你是一位持证马来西亚认证财务规划师（CFP），请根据以下真实财务数据，用简体中文写一份约600字的个人财务健康评估报告。

用户财务数据：
- 姓名：${name}
- 年龄：${age !== null ? `${age} 岁` : '未填写'}
- 地区：马来西亚槟城（Penang）
- 过去6个月平均月收入：RM ${avgMonthlyIncome.toFixed(0)}
- 过去6个月平均月支出：RM ${avgMonthlyExpense.toFixed(0)}
- 储蓄率：${savingsRate}%（月均储蓄 RM ${Math.max(0, avgMonthlyIncome - avgMonthlyExpense).toFixed(0)}）
- 净资产：RM ${netWorth.toFixed(0)}（资产 RM ${totalAssets.toFixed(0)} - 负债 RM ${totalDebt.toFixed(0)}）
- EPF（公积金）余额：RM ${epfBalance.toFixed(0)}
- 贷款月供占收入比例（DSR）：${debtServiceRatio}%
- 存钱目标：${activeGoals.length} 个进行中，已存 RM ${totalGoalSaved.toFixed(0)} / 目标 RM ${totalGoalTarget.toFixed(0)}
- 主要支出类别：${topCats.length > 0 ? topCats.join('、') : '暂无数据'}

请按以下结构分析（每部分用粗体标题）：

📊 **财务健康总评**
给出综合评分（0-100分），并用一句话总结当前财务状态。

💼 **收入评估**
与槟城同龄人平均收入对比（参考马来西亚统计局数据）。明确说明是否达标、差多少。

💰 **储蓄率分析**
${savingsRate}% 的储蓄率是否健康？（理想目标：20-30%）给出具体改善步骤。

🏦 **净资产状况**
按年龄阶段应有的净资产基准（参考马来西亚标准：净资产 ≈ 年收入 × 年龄 / 10），评估是否达标。

🎯 **EPF退休规划**
按当前EPF余额估算，退休时（55岁）预计EPF余额，能否支撑退休生活？（马来西亚退休基准：EPF RM240,000）

✅ **3个具体行动建议**
针对这位用户最迫切需要改善的3个具体且可执行的步骤，每条不超过50字。

语气要直接、诚实但鼓励，避免说废话，结合马来西亚本地实际情况。`

  try {
    const model = await getFlashModel()
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'text/plain', temperature: 0.7 },
    })
    const analysis = result.response.text().trim()
    return NextResponse.json({
      success: true,
      analysis,
      stats: {
        avgMonthlyIncome,
        avgMonthlyExpense,
        savingsRate,
        netWorth,
        epfBalance,
        debtServiceRatio,
        age,
      },
    })
  } catch (err) {
    console.error('[financial-profile]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
