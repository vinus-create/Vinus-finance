import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import { redirect, notFound } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import TransactionRow from '@/components/transactions/TransactionRow'
import EmptyState from '@/components/ui/EmptyState'
import { getServerTranslations } from '@/lib/i18n/server'
import { ACCOUNT_TYPE_CONFIG } from '@/lib/constants/accounts'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AccountDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { t, lang } = await getServerTranslations()

  // Fetch account
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!account) notFound()

  // Everything that moves this account's balance: rows booked ON it, plus
  // transfers INTO it (to_account_name). The balance trigger credits both, so
  // listing only account_name made balance and history disagree.
  // Two queries instead of .or(): account names contain "(", "," etc. that
  // would need PostgREST quoting.
  const cols = 'id, type, amount, currency, description, merchant_name, expense_category, income_category, transaction_date, transaction_time, account_name, to_account_name, ledger, created_at'
  const [{ data: booked }, { data: incoming }] = await Promise.all([
    supabase.from('transactions').select(cols)
      .eq('user_id', user.id).eq('account_name', account.name)
      .order('transaction_date', { ascending: false }).limit(200),
    supabase.from('transactions').select(cols)
      .eq('user_id', user.id).eq('type', 'transfer').eq('to_account_name', account.name)
      .order('transaction_date', { ascending: false }).limit(200),
  ])
  const seen = new Set<string>()
  const txns = [...(booked ?? []), ...(incoming ?? [])]
    .filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) =>
      b.transaction_date.localeCompare(a.transaction_date)
      || (b.transaction_time ?? '').localeCompare(a.transaction_time ?? '')
      || String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 200)

  // Signed effect of one row on THIS account (MYR only — unconverted foreign
  // rows are shown but not summed).
  const effect = (r: { type: string; amount: number; currency: string | null; account_name: string; to_account_name: string | null }) => {
    if ((r.currency ?? 'MYR') !== 'MYR') return 0
    const amt = Number(r.amount)
    if (r.type === 'income') return amt
    if (r.type === 'expense') return -amt
    if (r.type === 'transfer') {
      const out = r.account_name === account.name
      const inn = r.to_account_name === account.name
      return out && !inn ? -amt : inn && !out ? amt : 0
    }
    return 0
  }

  // Group by month
  const groups = txns.reduce<Record<string, typeof txns>>((acc, txn) => {
    const key = txn.transaction_date.slice(0, 7) // YYYY-MM
    if (!acc[key]) acc[key] = []
    acc[key].push(txn)
    return acc
  }, {})

  const cfg = ACCOUNT_TYPE_CONFIG[account.account_type as keyof typeof ACCOUNT_TYPE_CONFIG]
  const isNegative = account.balance < 0
  // A credit card's negative balance is money owed — label it as such
  // instead of showing a "−" under the word 余额.
  const isCardDebt = account.account_type === 'credit_card' && isNegative
  const OWED_LABEL = { zh: '欠款', en: 'Amount owed', ms: 'Baki tertunggak' } as const

  return (
    <div className="pb-28">
      <PageHeader title={account.name} showBack />

      {/* Account summary card */}
      <div className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: `${cfg?.color ?? '#888'}20` }}
          >
            {cfg?.emoji ?? '🏦'}
          </div>
          <div>
            <p className="text-sm font-semibold">{account.name}</p>
            <p className="text-xs text-muted-foreground">
              {account.institution ?? ''}
              {account.institution && account.account_number ? ' · ' : ''}
              {account.account_number ? `••••${account.account_number}` : ''}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-0.5">
          {isCardDebt ? OWED_LABEL[lang as keyof typeof OWED_LABEL] ?? OWED_LABEL.en : t.account_balance_label}
        </p>
        <p className={`text-2xl font-bold ${isNegative ? 'text-red-500' : ''}`}>
          {isNegative && !isCardDebt ? '-' : ''}RM {Math.abs(account.balance).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Transactions */}
      <div className="px-4 mt-5">
        {txns.length === 0 ? (
          <EmptyState emoji="💳" title={t.empty_transactions} body={t.empty_transactions_hint} />
        ) : (
          <div className="space-y-5">
            {Object.entries(groups).map(([monthKey, items]) => {
              const [y, m] = monthKey.split('-')
              const label = new Date(Number(y), Number(m) - 1).toLocaleDateString(lang, { year: 'numeric', month: 'long' })
              const monthTotal = items.reduce((sum, txn) => sum + effect(txn), 0)

              return (
                <div key={monthKey}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className={`text-xs font-semibold ${monthTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {monthTotal >= 0 ? '+' : ''}RM {monthTotal.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
                    {items.map(txn => (
                      <TransactionRow
                        key={txn.id as string}
                        txn={txn as unknown as Parameters<typeof TransactionRow>[0]['txn']}
                        lang={lang}
                        showDate
                        viewAccount={account.name}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
