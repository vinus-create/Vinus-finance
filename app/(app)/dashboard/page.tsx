import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import BalanceSummaryCard from '@/components/dashboard/BalanceSummaryCard'
import SpendingBreakdown from '@/components/dashboard/SpendingBreakdown'
import DashboardWidgets from '@/components/dashboard/DashboardWidgets'
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

  // Build date strings directly — avoid toISOString() which shifts by UTC offset
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startOfMonth = `${year}-${mm}-01`
  const endOfMonth = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

  let txns: Array<Record<string, unknown>> | null = null
  {
    const { data: d1, error: e1 } = await supabase
      .from('transactions')
      .select('type, amount, expense_category, income_category, description, merchant_name, transaction_date, id, ledger')
      .eq('user_id', user.id)
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth)
      .order('transaction_date', { ascending: false })
    if (e1) {
      const { data: d2 } = await supabase
        .from('transactions')
        .select('type, amount, expense_category, income_category, description, merchant_name, transaction_date, id')
        .eq('user_id', user.id)
        .gte('transaction_date', startOfMonth)
        .lte('transaction_date', endOfMonth)
        .order('transaction_date', { ascending: false })
      txns = (d2 ?? []).map(r => ({ ...r, ledger: 'personal' }))
    } else {
      txns = d1
    }
  }

  const totalIncome = txns?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) ?? 0
  const totalExpense = txns?.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) ?? 0

  // Business summary
  const bizTxns = txns?.filter(t => t.ledger === 'business') ?? []
  const bizRevenue = bizTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const bizExpenses = bizTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const bizProfit = bizRevenue - bizExpenses
  const bizMargin = bizRevenue > 0 ? (bizProfit / bizRevenue) * 100 : 0
  const hasBizData = bizTxns.length > 0

  // Top 5 expense categories
  const catSpend: Record<string, number> = {}
  for (const txn of txns ?? []) {
    if (txn.type === 'expense' && txn.expense_category) {
      const cat = txn.expense_category as string
      catSpend[cat] = (catSpend[cat] ?? 0) + Number(txn.amount)
    }
  }
  const topCategories = Object.entries(catSpend)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({ category: category as ExpenseCategory, amount }))

  const recent = txns?.slice(0, 5) ?? []

  // ── Widget data (parallel fetch) ──────────────────────────
  const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1)
  const next7Days = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [billsRes, loansRes, budgetsRes, remindersRes] = await Promise.all([
    supabase.from('monthly_bills').select('amount, frequency_months').eq('user_id', user.id).eq('is_active', true),
    supabase.from('loans').select('monthly_payment').eq('user_id', user.id).eq('is_active', true).gt('outstanding_balance', 0),
    supabase.from('budgets').select('budget_amount').eq('user_id', user.id).eq('period_year', year).eq('period_month', month),
    isCurrentMonth
      ? supabase.from('reminders').select('id, title, amount, due_date').eq('user_id', user.id).eq('status', 'active')
          .gte('due_date', todayStr).lte('due_date', next7Days).order('due_date').limit(5)
      : Promise.resolve({ data: [] }),
  ])

  const totalBills = (billsRes.data ?? []).reduce((s, b) => s + Number(b.amount), 0)
  const totalLoans = (loansRes.data ?? []).reduce((s, l) => s + Number(l.monthly_payment), 0)
  const totalBudget = (budgetsRes.data ?? []).reduce((s, b) => s + Number(b.budget_amount), 0)
  const upcomingReminders = (remindersRes.data ?? []) as Array<{ id: string; title: string; amount: number | null; due_date: string }>

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
              const txnType = txn.type as string
              const expCat = txn.expense_category as ExpenseCategory | null
              const incCat = txn.income_category as IncomeCategory | null
              const cat = txnType === 'expense' && expCat
                ? EXPENSE_CATEGORY_MAP[expCat]
                : incCat
                ? INCOME_CATEGORY_MAP[incCat]
                : undefined
              const icon = cat?.icon ?? (txnType === 'income' ? '💰' : '💸')
              const catValue = txnType === 'expense' ? expCat : incCat
              const catLabel = catValue ? getCategoryLabel(catValue, txnType, lang) : ''
              const name = (txn.merchant_name as string | null) ?? (txn.description as string | null) ?? catLabel ?? t.txn_unnamed

              return (
                <div
                  key={txn.id as string}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                >
                  <span className="text-xl shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">{txn.transaction_date as string}</p>
                  </div>
                  <p className={`text-sm font-semibold ml-3 shrink-0 ${txnType === 'income' ? 'text-emerald-600' : ''}`}>
                    {txnType === 'income' ? '+' : '−'}RM {Number(txn.amount).toFixed(2)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Business Summary (only when business transactions exist) */}
      {hasBizData && (
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              🏪 {t.business_title}
            </h2>
            <a href="/transactions?ledger=business" className="text-sm text-emerald-600 font-medium">
              {t.dashboard_view_all}
            </a>
          </div>
          <div className="grid grid-cols-4 gap-2 p-4 rounded-2xl bg-card border border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">{t.business_revenue}</p>
              <p className="text-sm font-bold text-emerald-600">RM {bizRevenue.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{t.business_expenses}</p>
              <p className="text-sm font-bold">RM {bizExpenses.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{t.business_profit}</p>
              <p className={`text-sm font-bold ${bizProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                RM {bizProfit.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{t.business_margin}</p>
              <p className={`text-sm font-bold ${bizMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {bizMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Dashboard Widgets (customizable) */}
      <DashboardWidgets data={{
        totalBills,
        totalLoans,
        totalBudget,
        budgetSpent: totalExpense,
        reminders: upcomingReminders,
        userId: user.id,
      }} />

      {/* Top spending categories */}
      <SpendingBreakdown items={topCategories} total={totalExpense} />

      <div className="h-4" />
    </div>
  )
}
