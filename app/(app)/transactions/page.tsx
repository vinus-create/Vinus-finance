import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/layout/PageHeader'
import MonthNav from '@/components/transactions/MonthNav'
import TransactionsController from '@/components/transactions/TransactionsController'
import TransactionRow from '@/components/transactions/TransactionRow'
import EmptyState from '@/components/ui/EmptyState'
import { getServerTranslations } from '@/lib/i18n/server'
import { DATE_LOCALE } from '@/lib/i18n/index'

interface Props {
  searchParams: Promise<{ month?: string; new?: string; ledger?: string }>
}

export default async function TransactionsPage({ searchParams }: Props) {
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

  // Ledger filter
  const ledgerFilter = params.ledger === 'personal' ? 'personal'
    : params.ledger === 'business' ? 'business'
    : null // null = all

  // Build date strings directly — avoid toISOString() which shifts by UTC offset
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startOfMonth = `${year}-${mm}-01`
  const endOfMonth = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

  const monthParam = `${year}-${mm}`
  let query = supabase
    .from('transactions')
    .select('id, type, amount, currency, description, merchant_name, expense_category, income_category, transaction_date, account_name, ledger')
    .eq('user_id', user.id)
    .gte('transaction_date', startOfMonth)
    .lte('transaction_date', endOfMonth)
    .order('transaction_date', { ascending: false })
  if (ledgerFilter) query = query.eq('ledger', ledgerFilter)
  const { data: txns } = await query

  // Month summary (transfers counted as outgoing / expense)
  const totalIncome = txns?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) ?? 0
  const totalExpense = txns?.filter(t => t.type === 'expense' || t.type === 'transfer').reduce((s, t) => s + Number(t.amount), 0) ?? 0

  // Group by date
  const groups: Record<string, typeof txns> = {}
  for (const txn of txns ?? []) {
    if (!groups[txn.transaction_date]) groups[txn.transaction_date] = []
    groups[txn.transaction_date]!.push(txn)
  }
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    // Build today/yesterday strings without toISOString() to avoid UTC shift
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const yest = new Date(now); yest.setDate(yest.getDate() - 1)
    const yestStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`
    if (dateStr === todayStr) return t.txn_today
    if (dateStr === yestStr) return t.txn_yesterday
    return d.toLocaleDateString(DATE_LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div>
      <PageHeader title={t.txn_title} />

      {/* Month navigation */}
      <MonthNav year={year} month={month} />

      {/* Ledger filter pills */}
      <div className="flex gap-2 px-4 pt-3 pb-1">
        {[
          { key: null,         label: t.txn_filter_all },
          { key: 'personal',   label: `👤 ${t.txn_filter_personal}` },
          { key: 'business',   label: `🏪 ${t.txn_filter_business}` },
        ].map(({ key, label }) => {
          const href = key
            ? `/transactions?month=${monthParam}&ledger=${key}`
            : `/transactions?month=${monthParam}`
          return (
            <Link
              key={key ?? 'all'}
              href={href}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                ledgerFilter === key
                  ? 'bg-emerald-500 border-emerald-500 text-white font-semibold'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Month summary strip */}
      {(txns?.length ?? 0) > 0 && (
        <div className="flex gap-4 px-4 py-2.5 text-sm border-b border-border bg-muted/30">
          <span className="text-emerald-600 font-semibold">
            + RM {totalIncome.toFixed(2)}
          </span>
          <span className="text-muted-foreground">−</span>
          <span className="font-semibold">
            − RM {totalExpense.toFixed(2)}
          </span>
          <span className="text-muted-foreground ml-auto">
            {txns?.length} {t.txn_records}
          </span>
        </div>
      )}

      {/* Client component: handles ?new=1 and QuickAdd sheet */}
      <Suspense>
        <TransactionsController />
      </Suspense>

      {/* Transaction list grouped by date */}
      <div className="pb-2">
        {sortedDates.length === 0 ? (
          <EmptyState
            emoji="📭"
            title={t.empty_transactions}
            body={t.empty_transactions_hint}
          />
        ) : (
          sortedDates.map(dateStr => (
            <div key={dateStr}>
              {/* Date header */}
              <div className="px-4 py-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {formatDate(dateStr)}
                </p>
                <p className="text-xs text-muted-foreground">
                  RM {groups[dateStr]!
                    .reduce((s, txn) => s + (txn.type === 'income' ? 1 : -1) * Number(txn.amount), 0)
                    .toFixed(2)}
                </p>
              </div>

              {/* Transactions for this date */}
              <div className="px-4 space-y-1.5">
                {groups[dateStr]!.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} lang={lang} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
