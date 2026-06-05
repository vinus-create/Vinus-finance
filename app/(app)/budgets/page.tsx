import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import BudgetsClient from '@/components/budgets/BudgetsClient'
import type { ExpenseCategory } from '@/lib/types/app.types'
import { getServerTranslations } from '@/lib/i18n/server'
import { DATE_LOCALE } from '@/lib/i18n/index'

export default async function BudgetsPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { t, lang } = await getServerTranslations()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthLabel = now.toLocaleDateString(DATE_LOCALE[lang], { month: 'long', year: 'numeric' })

  // Build date strings directly — avoid toISOString() which shifts by UTC offset
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startOfMonth = `${year}-${mm}-01`
  const endOfMonth = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

  // Fetch this month's budgets and actual spend in parallel
  const [{ data: budgets }, { data: txns }] = await Promise.all([
    supabase
      .from('budgets')
      .select('id, expense_category, budget_amount')
      .eq('user_id', user.id)
      .eq('period_year', year)
      .eq('period_month', month),
    supabase
      .from('transactions')
      .select('expense_category, amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth),
  ])

  // Build spend map per category
  const spendMap: Record<string, number> = {}
  for (const t of txns ?? []) {
    if (t.expense_category) {
      spendMap[t.expense_category] = (spendMap[t.expense_category] ?? 0) + Number(t.amount)
    }
  }

  const budgetList = (budgets ?? []).map(b => ({
    id: b.id as string,
    category: b.expense_category as ExpenseCategory,
    budgetAmount: Number(b.budget_amount),
    spentAmount: spendMap[b.expense_category] ?? 0,
  }))

  // Total budget vs total spent
  const totalBudget = budgetList.reduce((s, b) => s + b.budgetAmount, 0)
  const totalSpent = budgetList.reduce((s, b) => s + b.spentAmount, 0)

  return (
    <div>
      <PageHeader title={t.budgets_title} showBack />

      {/* Month summary card */}
      {budgetList.length > 0 && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border">
          <p className="text-xs text-muted-foreground mb-3">{monthLabel}</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{t.budgets_this_month}</p>
              <p className="font-bold text-sm">RM {totalBudget.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.balance_expense}</p>
              <p className={`font-bold text-sm ${totalSpent > totalBudget ? 'text-red-500' : ''}`}>
                RM {totalSpent.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.balance_net}</p>
              <p className={`font-bold text-sm ${totalBudget - totalSpent < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                RM {(totalBudget - totalSpent).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${totalSpent > totalBudget ? 'bg-red-500' : totalSpent / totalBudget > 0.8 ? 'bg-orange-400' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Budget rows */}
      <BudgetsClient year={year} month={month} budgetList={budgetList} />
    </div>
  )
}
