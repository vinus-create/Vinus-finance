import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import BalanceSummaryCard from '@/components/dashboard/BalanceSummaryCard'
import SpendingBreakdown from '@/components/dashboard/SpendingBreakdown'
import MonthNav from '@/components/transactions/MonthNav'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import type { ExpenseCategory, IncomeCategory } from '@/lib/types/app.types'
import { EXPENSE_CATEGORY_MAP, INCOME_CATEGORY_MAP } from '@/lib/constants/categories'
import { getCategoryLabel } from '@/lib/utils/category-i18n'
import EmptyState from '@/components/ui/EmptyState'
import { getServerTranslations } from '@/lib/i18n/server'
import { DATE_LOCALE } from '@/lib/i18n/index'

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t, lang } = await getServerTranslations()

  // Parse month param, default to current month
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split('-').map(Number)
    year = y
    month = m
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(DATE_LOCALE[lang], {
    month: 'long',
    year: 'numeric',
  })

  const startOfMonth = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const endOfMonth = new Date(year, month, 0).toISOString().slice(0, 10)

  const { data: txns } = await supabase
    .from('transactions')
    .select('type, amount, expense_category, income_category, description, merchant_name, transaction_date, id')
    .eq('user_id', user.id)
    .gte('transaction_date', startOfMonth)
    .lte('transaction_date', endOfMonth)
    .order('transaction_date', { ascending: false })

  const totalIncome = txns?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) ?? 0
  const totalExpense = txns?.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) ?? 0

  // Top 5 expense categories
  const catSpend: Record<string, number> = {}
  for (const txn of txns ?? []) {
    if (txn.type === 'expense' && txn.expense_category) {
      catSpend[txn.expense_category] = (catSpend[txn.expense_category] ?? 0) + Number(txn.amount)
    }
  }
  const topCategories = Object.entries(catSpend)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({ category: category as ExpenseCategory, amount }))

  const recent = txns?.slice(0, 5) ?? []

  return (
    <div>
      <PageHeader
        title="Vinus Finance"
        right={
          <Link href="/reminders" aria-label={t.reminders_title}>
            <Bell className="w-6 h-6 text-muted-foreground" />
          </Link>
        }
      />

      {/* Month navigation for dashboard */}
      <MonthNav year={year} month={month} basePath="/dashboard" />

      <BalanceSummaryCard
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        month={monthLabel}
      />

      {/* Recent Transactions */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t.dashboard_recent}
          </h2>
          <Link href="/transactions" className="text-sm text-emerald-600 font-medium">
            {t.dashboard_view_all}
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            emoji="📭"
            title={t.empty_transactions}
            body={t.empty_transactions_hint}
          />
        ) : (
          <div className="space-y-2">
            {recent.map((txn) => {
              const cat = txn.type === 'expense' && txn.expense_category
                ? EXPENSE_CATEGORY_MAP[txn.expense_category as ExpenseCategory]
                : txn.income_category
                ? INCOME_CATEGORY_MAP[txn.income_category as IncomeCategory]
                : undefined
              const icon = cat?.icon ?? (txn.type === 'income' ? '💰' : '💸')
              const catValue = txn.type === 'expense' ? txn.expense_category : txn.income_category
              const catLabel = catValue ? getCategoryLabel(catValue, txn.type, lang) : ''
              const name = txn.merchant_name ?? txn.description ?? catLabel ?? t.txn_unnamed

              return (
                <div
                  key={txn.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                >
                  <span className="text-xl shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">{txn.transaction_date}</p>
                  </div>
                  <p className={`text-sm font-semibold ml-3 shrink-0 ${txn.type === 'income' ? 'text-emerald-600' : ''}`}>
                    {txn.type === 'income' ? '+' : '−'}RM {Number(txn.amount).toFixed(2)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Top spending categories */}
      <SpendingBreakdown items={topCategories} total={totalExpense} />

      <div className="h-4" />
    </div>
  )
}
