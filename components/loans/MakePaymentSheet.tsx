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
import type { Loan } from '@/lib/types/app.types'

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

  // Reset to latest loan values when sheet opens
  useEffect(() => {
    if (open) {
      setAmount(loan.monthly_payment.toFixed(2))
      setDate(new Date().toISOString().slice(0, 10))
    }
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
  const nextPaymentDate = advanceMonths(date, 1)

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
        account_name: 'Cash',
        transaction_date: date,
        is_tax_deductible: false,
      })
      if (txnErr) throw new Error(txnErr.message)

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
