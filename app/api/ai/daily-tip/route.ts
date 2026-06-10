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

    // Random famous investor to prevent repetitive responses
    const FAMOUS_INVESTORS = [
      { name: '沃伦·巴菲特', en: 'Warren Buffett', style: '价值投资，长期持有，避免负债' },
      { name: '查理·芒格', en: 'Charlie Munger', style: '心理模型，逆向思维，避免愚蠢行为' },
      { name: '彼得·林奇', en: 'Peter Lynch', style: '了解你所投资的，消费行为即投资信号' },
      { name: '瑞·达利欧', en: 'Ray Dalio', style: '原则，风险平衡，债务周期' },
      { name: '罗伯特·清崎', en: 'Robert Kiyosaki', style: '资产与负债，被动收入，财商教育' },
      { name: '本杰明·格雷厄姆', en: 'Benjamin Graham', style: '安全边际，内在价值，市场情绪' },
      { name: '约翰·博格', en: 'John Bogle', style: '低成本指数基金，长期复利，避免择时' },
      { name: '乔治·索罗斯', en: 'George Soros', style: '反身性理论，市场预期，风险管理' },
    ]
    const investor = FAMOUS_INVESTORS[Math.floor(Math.random() * FAMOUS_INVESTORS.length)]!

    const model = await getFlashModel()
    const result = await model.generateContent(
      `你是马来西亚个人理财助手 Vinus Finance。

今日特邀投资大师：${investor.name}（${investor.en}）
其投资哲学：${investor.style}

请严格按以下格式回复（必须包含全部两个部分）：

💡 [针对用户财务数据的具体建议，30-50字，结合用户实际数字]

📖 "[${investor.name}的一句真实名言，中文]" —— ${investor.name}
→ [一句话说明这句话与用户当前处境的直接关联，20-30字]

规则：
- 名言必须是${investor.name}真实说过的，不可虚构
- 💡 和 📖 两部分缺一不可
- 直接输出，不要 JSON，不要代码块

用户财务数据：
${context}`
    )
    const tip = cleanTip(result.response.text())

    return NextResponse.json({ tip }, {
      headers: { 'Cache-Control': 'no-store' },  // always fresh from AI
    })
  } catch (err) {
    console.error('[AI daily tip]', err)
    return NextResponse.json({ tip: null })
  }
}
