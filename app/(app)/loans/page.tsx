import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import LoanCard from '@/components/loans/LoanCard'
import LoansClient from '@/components/loans/LoansClient'
import type { Loan } from '@/lib/types/app.types'
import EmptyState from '@/components/ui/EmptyState'
import { getServerTranslations } from '@/lib/i18n/server'

export default async function LoansPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { t } = await getServerTranslations()

  const { data: loans } = await supabase
    .from('loans')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const activeLoans = (loans ?? []) as Loan[]

  // Total monthly commitment
  const totalMonthly = activeLoans.reduce((s, l) => s + l.monthly_payment, 0)
  const totalOutstanding = activeLoans.reduce((s, l) => s + l.outstanding_balance, 0)

  return (
    <div>
      <PageHeader title={t.loans_title} showBack />

      {/* Summary bar */}
      {activeLoans.length > 0 && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t.more_loans}</p>
            <p className="text-lg font-bold">
              RM {totalOutstanding.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t.balance_expense} / {t.tax_per_month}</p>
            <p className="text-lg font-bold text-orange-500">
              RM {totalMonthly.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Client component: tabs (Tracker | Calculator) + Add Loan FAB */}
      <Suspense>
        <LoansClient loans={activeLoans}>
          {/* Loan cards — server-rendered, passed as slot */}
          {activeLoans.length === 0 ? (
            <EmptyState
              emoji="🏦"
              title={t.empty_loans}
              body={t.empty_loans_hint}
            />
          ) : (
            <div className="space-y-3 pb-2">
              {activeLoans.map(loan => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          )}
        </LoansClient>
      </Suspense>
    </div>
  )
}
