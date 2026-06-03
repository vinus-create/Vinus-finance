import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/layout/PageHeader'
import MonthNav from '@/components/transactions/MonthNav'
import TransactionsController from '@/components/transactions/TransactionsController'
import TransactionRow from '@/components/transactions/TransactionRow'
import TransactionSearch from '@/components/transactions/TransactionSearch'
import EmptyState from '@/components/ui/EmptyState'
import { getServerTranslations } from '@/lib/i18n/server'
import { DATE_LOCALE } from '@/lib/i18n/index'

interface Props {
  searchParams: Promise<{ month?: string; new?: string; ledger?: string; q?: string }>
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

  // Search query
  const searchQuery = params.q?.trim() ?? ''

  // Build date strings directly — avoid toISOString() which shifts by UTC offset
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startOfMonth = `${year}-${mm}-01`
  const endOfMonth = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

  const monthParam = `${year}-${mm}`

  // Try with ledger column; fall back gracefully if SQL migration not yet run
  let txns: Array<Record<string, unknown>> | null = null
  {
    const q = supabase
      .from('transactions')
      .select('id, type, amount, currency, description, merchant_name, expense_category, income_category, transaction_date, account_name, ledger')
      .eq('user_id', user.id)
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth)
      .order('transaction_date', { ascending: false })
    const { data: d1, error: e1 } = await (ledgerFilter ? q.eq('ledger', ledgerFilter) : q)
    if (e1) {
      const { data: d2 } = await supabase
        .from('transactions')
        .select('id, type, amount, currency, description, merchant_name, expense_category, income_category, transaction_date, account_name')
        .eq('user_id', user.id)
        .gte('transaction_date', startOfMonth)
        .lte('transaction_date', endOfMonth)
        .order('transaction_date', { ascending: false })
      txns = (d2 ?? []).map(r => ({ ...r, ledger: 'personal' }))
    } else {
      txns = d1
    }
  }

  // Client-side search filter (keyword match on merchant + description)
  const filtered = searchQuery
    ? (txns ?? []).filter(txn => {
        const haystack = `${txn.merchant_name ?? ''} ${txn.description ?? ''}`.toLowerCase()
        return haystack.includes(searchQuery.toLowerCase())
      })
    : (txns ?? [])

  // Month summary — internal transfers excluded from both income and expense
  const totalIncome = txns?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) ?? 0
  const totalExpense = txns?.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) ?? 0

  // Group by date (use filtered list)
  const groups: Record<string, typeof filtered> = {}
  for (const txn of filtered) {
    const dateKey = txn.transaction_date as string
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey]!.push(txn)
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
      <PageHeader
        title={t.txn_title}
        right={
          <a
            href={`/api/export?month=${monthParam}`}
            download
            className="text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg hover:bg-muted/70 transition-colors"
          >
            {t.export_csv_btn}
          </a>
        }
      />

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

      {/* Search bar */}
      <Suspense>
        <TransactionSearch />
      </Suspense>

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
            emoji={searchQuery ? '🔍' : '📭'}
            title={searchQuery ? t.txn_no_results : t.empty_transactions}
            body={searchQuery ? `"${searchQuery}"` : t.empty_transactions_hint}
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
                  <TransactionRow key={txn.id as string} txn={txn as unknown as Parameters<typeof TransactionRow>[0]['txn']} lang={lang} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
