import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/layout/PageHeader'
import BillsClient from '@/components/bills/BillsClient'

export default async function BillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: bills }, { data: loans }] = await Promise.all([
    supabase
      .from('monthly_bills')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('due_day', { ascending: true }),
    supabase
      .from('loans')
      .select('id, name, monthly_payment, next_payment_date, loan_type, lender_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gt('outstanding_balance', 0)
      .order('monthly_payment', { ascending: false }),
  ])

  const LOAN_EMOJI: Record<string, string> = {
    home_loan: '🏠', car_loan: '🚗', personal_loan: '💼',
    business_loan: '🏪', credit_card: '💳', bnpl: '📦', other_loan: '🏦',
  }

  // Monthly equivalent for bills (amount = per-occurrence amount, already monthly equivalent stored)
  const totalBills = (bills ?? []).reduce((s, b) => s + Number(b.amount), 0)
  const totalLoans = (loans ?? []).reduce((s, l) => s + Number(l.monthly_payment), 0)
  const totalFixed = totalBills + totalLoans

  return (
    <div>
      <PageHeader title="每月账单" />
      <div className="px-4 pb-24 space-y-5">

        {/* Combined summary */}
        <div className="mt-4 p-4 rounded-2xl bg-card border border-border space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">每月固定总支出</p>
          <p className="text-3xl font-bold text-red-500">
            RM {totalFixed.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">🧾 账单</p>
              <p className="text-sm font-semibold">RM {totalBills.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{(bills ?? []).length} 项</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">🏦 贷款月供</p>
              <p className="text-sm font-semibold">RM {totalLoans.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{(loans ?? []).length} 笔</p>
            </div>
          </div>
        </div>

        {/* Bills section */}
        <BillsClient initialBills={bills ?? []} />

        {/* Loan repayments — read-only view */}
        {(loans ?? []).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">贷款月供</p>
              <Link href="/loans" className="text-xs text-emerald-600 hover:underline">管理 →</Link>
            </div>
            <div className="space-y-2">
              {(loans ?? []).map(loan => (
                <div key={loan.id} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
                  <span className="text-2xl shrink-0">{LOAN_EMOJI[loan.loan_type] ?? '🏦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{loan.name}</p>
                    <p className="text-xs text-muted-foreground">{loan.lender_name ?? '—'}</p>
                    {loan.next_payment_date && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        下次还款：{loan.next_payment_date}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-red-500">−RM {Number(loan.monthly_payment).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">每月</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
