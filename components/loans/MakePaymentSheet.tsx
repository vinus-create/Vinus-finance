'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { calcPaymentSplit, advanceMonths } from '@/lib/utils/loan-math'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { Loan, Account } from '@/lib/types/app.types'

function accountEmoji(type: Account['account_type']): string {
  const map: Record<string, string> = { bank: '🏦', ewallet: '💳', investment: '📈', cash: '💵', credit_card: '💳', other: '🏧' }
  return map[type] ?? '🏦'
}

interface Props {
  loan: Loan
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function MakePaymentSheet({ loan, open, onOpenChange }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const [saving, setSaving] = useState(false)
  const [amount, setAmount] = useState(loan.monthly_payment.toFixed(2))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('Cash')

  // Load accounts + reset form when sheet opens
  useEffect(() => {
    if (!open) return
    setAmount(loan.monthly_payment.toFixed(2))
    setDate(new Date().toISOString().slice(0, 10))

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true)
        .order('created_at').then(({ data }) => {
          if (data && data.length > 0) {
            const accts = data as Account[]
            setAccounts(accts)
            // Default: prefer Cash account, else first account
            const cash = accts.find(a => a.account_type === 'cash' || a.name.toLowerCase().includes('cash'))
            setSelectedAccount(cash?.name ?? accts[0]!.name)
          }
        })
    })
  }, [open, loan.monthly_payment])

  const paymentAmt = parseFloat(amount) || 0

  const split = paymentAmt > 0
    ? calcPaymentSplit(
        loan.outstanding_balance,
        loan.principal_amount,
        loan.interest_rate,
        paymentAmt,
        loan.tenure_months,
        loan.interest_method,
      )
    : { principal: 0, interest: 0 }

  const newBalance = Math.max(0, loan.outstanding_balance - split.principal)
  const newRemaining = Math.max(0, (loan.remaining_months ?? loan.tenure_months) - 1)
  // Advance from the loan's scheduled due date (preserves day-of-month), not from the user's payment date
  const nextPaymentDate = advanceMonths(loan.next_payment_date ?? loan.start_date, 1)

  async function handleSave() {
    if (paymentAmt <= 0) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)

      // 1. Record transaction
      const { error: txnErr } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'expense',
        amount: paymentAmt,
        currency: 'MYR',
        expense_category: 'loan_repayment',
        description: loan.name,
        merchant_name: loan.lender_name ?? null,
        account_name: selectedAccount,
        transaction_date: date,
        is_tax_deductible: false,
      })
      if (txnErr) throw new Error(txnErr.message)

      // 1b. Deduct from selected account balance
      const { data: acct } = await supabase.from('accounts').select('id, balance')
        .eq('user_id', user.id).eq('name', selectedAccount).maybeSingle()
      if (acct) await supabase.from('accounts').update({ balance: acct.balance - paymentAmt }).eq('id', acct.id)

      // 2. Update loan
      const { error: loanErr } = await supabase.from('loans').update({
        outstanding_balance: newBalance,
        remaining_months: newRemaining,
        next_payment_date: nextPaymentDate,
        updated_at: new Date().toISOString(),
      }).eq('id', loan.id)
      if (loanErr) throw new Error(loanErr.message)

      // 3. Mark linked reminders done (if any)
      await supabase.from('reminders')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('linked_loan_id', loan.id)
        .eq('status', 'active')
        .lte('due_date', date)

      toast.success(`${loan.name} — ${t.loan_pay_title}`)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{t.loan_pay_title}</SheetTitle>
          <p className="text-sm text-muted-foreground">{loan.name}</p>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 mt-3">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.loan_pay_amount_label}</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="h-11 text-base"
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.loan_pay_date_label}</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Account picker */}
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">从哪个户口还款</Label>
              <div className="flex flex-wrap gap-2">
                {accounts.map(acct => (
                  <button
                    key={acct.id}
                    onClick={() => setSelectedAccount(acct.name)}
                    className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors ${
                      selectedAccount === acct.name
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span>{accountEmoji(acct.account_type)}</span>
                    <span>{acct.name}</span>
                    <span className={`text-xs ${selectedAccount === acct.name ? 'text-white/80' : 'text-muted-foreground'}`}>
                      RM {Number(acct.balance).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown */}
          {paymentAmt > 0 && (
            <div className="p-3 rounded-xl bg-muted space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t.loan_pay_breakdown}
              </p>
              <div className="flex justify-between text-sm">
                <span>{t.loan_pay_principal}</span>
                <span className="font-medium">RM {split.principal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t.loan_pay_interest}</span>
                <span className="font-medium">RM {split.interest.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">{t.loan_balance_label}</span>
                <span className="font-semibold text-emerald-600">RM {newBalance.toFixed(2)}</span>
              </div>
            </div>
          )}

          <Button
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
            onClick={handleSave}
            disabled={saving || paymentAmt <= 0}
          >
            {saving ? t.loan_pay_saving : t.loan_pay_btn}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
