'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { calcByMethod, calcBalanceAtMonth, advanceMonths } from '@/lib/utils/loan-math'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { Loan } from '@/lib/types/app.types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan?: Loan   // present → edit mode
}

function blankForm() {
  return {
    name: '',
    lender_name: '',
    loan_type: 'car_loan',
    interest_method: 'reducing_balance',
    principal_amount: '',
    interest_rate: '',
    tenure_years: '',
    start_date: new Date().toISOString().slice(0, 10),
    months_paid: '0',
  }
}

function loanToForm(loan: Loan) {
  const monthsPaid = loan.tenure_months - (loan.remaining_months ?? loan.tenure_months)
  return {
    name: loan.name,
    lender_name: loan.lender_name ?? '',
    loan_type: loan.loan_type,
    interest_method: loan.interest_method,
    principal_amount: String(loan.principal_amount),
    interest_rate: String(loan.interest_rate),
    tenure_years: String(loan.tenure_months / 12),
    start_date: loan.start_date,
    months_paid: String(monthsPaid),
  }
}

export default function AddLoanSheet({ open, onOpenChange, loan }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const isEdit = !!loan

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(loan ? loanToForm(loan) : blankForm())
  const [autoRemind, setAutoRemind] = useState(false)

  // Sync form when sheet opens / loan prop changes
  useEffect(() => {
    if (open) { setForm(loan ? loanToForm(loan) : blankForm()); setAutoRemind(false) }
  }, [open, loan])

  const LOAN_TYPES = [
    { value: 'home_loan',      label: t.loan_type_home },
    { value: 'car_loan',       label: t.loan_type_car },
    { value: 'personal_loan',  label: t.loan_type_personal },
    { value: 'business_loan',  label: t.loan_type_business },
    { value: 'credit_card',    label: t.loan_type_credit },
    { value: 'bnpl',           label: t.loan_type_bnpl },
    { value: 'other_loan',     label: t.loan_type_other },
  ]

  const INTEREST_METHODS = [
    { value: 'reducing_balance',  label: t.method_reducing,   isIslamic: false },
    { value: 'flat_rate',         label: t.method_flat,        isIslamic: false },
    { value: 'islamic_bba',       label: t.method_bba,         isIslamic: true },
    { value: 'islamic_murabahah', label: t.method_murabahah,   isIslamic: true },
    { value: 'islamic_tawarruq',  label: t.method_tawarruq,    isIslamic: true },
    { value: 'zero_interest',     label: t.method_zero,        isIslamic: false },
  ]

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const tenureMonths = Math.round(parseFloat(form.tenure_years || '0') * 12)
  const principal = parseFloat(form.principal_amount || '0')
  const rate = parseFloat(form.interest_rate || '0')
  const monthsPaid = Math.min(parseInt(form.months_paid || '0', 10), tenureMonths)

  const calc = principal > 0 && tenureMonths > 0
    ? calcByMethod(principal, rate, tenureMonths, form.interest_method)
    : null

  const selectedMethod = INTEREST_METHODS.find(m => m.value === form.interest_method)
  const isIslamic = selectedMethod?.isIslamic ?? false

  // Recalculate outstanding balance based on months paid
  const recalcBalance = calc && principal > 0 && tenureMonths > 0
    ? calcBalanceAtMonth(principal, rate, calc.monthly, tenureMonths, monthsPaid, form.interest_method)
    : principal

  async function handleSave() {
    if (!form.name.trim() || !principal || !tenureMonths) {
      setError(t.form_err_loan)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)

      const startDate = new Date(form.start_date)
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + tenureMonths)

      const nextPaymentDateStr = advanceMonths(form.start_date, monthsPaid + 1)
      const remainingMonths = Math.max(0, tenureMonths - monthsPaid)

      const payload = {
        name: form.name.trim(),
        lender_name: form.lender_name.trim() || null,
        loan_type: form.loan_type,
        interest_method: form.interest_method,
        is_islamic: isIslamic,
        principal_amount: principal,
        outstanding_balance: recalcBalance,
        interest_rate: rate,
        monthly_payment: calc?.monthly ?? 0,
        tenure_months: tenureMonths,
        remaining_months: remainingMonths,
        start_date: form.start_date,
        end_date: endDate.toISOString().slice(0, 10),
        next_payment_date: nextPaymentDateStr,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      if (isEdit && loan) {
        const { error: updateErr } = await supabase.from('loans').update(payload).eq('id', loan.id)
        if (updateErr) throw new Error(updateErr.message)
      } else {
        const { error: insertErr } = await supabase.from('loans').insert({
          ...payload,
          user_id: user.id,
        })
        if (insertErr) throw new Error(insertErr.message)
      }

      // 🔔 Auto-remind: create monthly bill reminder for loan payment
      if (autoRemind && calc) {
        await supabase.from('reminders').insert({
          user_id: user.id,
          title: `${form.name.trim()} 月供`,
          amount: calc.monthly,
          currency: 'MYR',
          due_date: nextPaymentDateStr,
          frequency: 'monthly',
          status: 'active',
          notify_push: true,
          notify_email: false,
          days_before: 3,
        })
      }

      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] overflow-y-auto">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{isEdit ? t.form_edit_loan : t.form_add_loan}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 mt-3">
          {/* Name + Lender */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_loan_name}</Label>
            <Input placeholder={t.form_loan_name_placeholder} value={form.name} onChange={e => set('name', e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_lender}</Label>
            <Input placeholder={t.form_lender_placeholder} value={form.lender_name} onChange={e => set('lender_name', e.target.value)} className="h-10" />
          </div>

          {/* Loan type */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_loan_type_label}</Label>
            <div className="grid grid-cols-2 gap-2">
              {LOAN_TYPES.map(lt => (
                <button
                  key={lt.value}
                  onClick={() => set('loan_type', lt.value)}
                  className={`p-2.5 rounded-xl text-xs text-left transition-colors border ${
                    form.loan_type === lt.value
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {lt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interest method */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_interest_method_label}</Label>
            <div className="space-y-1.5">
              {INTEREST_METHODS.map(m => (
                <label key={m.value} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-muted">
                  <input
                    type="radio"
                    name="interest_method"
                    value={m.value}
                    checked={form.interest_method === m.value}
                    onChange={() => set('interest_method', m.value)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm">{m.label}</span>
                  {m.isIslamic && <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full">{t.method_islamic_badge}</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_principal}</Label>
              <Input type="number" placeholder="300000" value={form.principal_amount} onChange={e => set('principal_amount', e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isIslamic ? t.form_profit_rate : t.form_interest_rate} {t.form_per_year}</Label>
              <Input type="number" step="0.05" placeholder="4.0" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_tenure}</Label>
              <Input type="number" placeholder="9" value={form.tenure_years} onChange={e => set('tenure_years', e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_start_date}</Label>
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="h-10" />
            </div>
          </div>

          {/* Months paid (always shown — important for tracking) */}
          {tenureMonths > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_months_paid} (0 – {tenureMonths})</Label>
              <Input
                type="number"
                min="0"
                max={tenureMonths}
                value={form.months_paid}
                onChange={e => set('months_paid', e.target.value)}
                className="h-10"
              />
            </div>
          )}

          {/* Auto-calculated monthly */}
          {calc && calc.monthly > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">{t.form_monthly_est}</p>
                  <p className="text-xl font-bold text-emerald-600">
                    RM {calc.monthly.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.form_total_pay} RM {calc.totalPayment.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {monthsPaid > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t.loan_balance_label}</p>
                    <p className="text-sm font-semibold">RM {recalcBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auto-remind toggle */}
          <div className="p-3 rounded-xl bg-muted">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium">🔔 添加至账单提醒</p>
                <p className="text-xs text-muted-foreground">每月还款前 3 天提醒</p>
              </div>
              <button
                onClick={() => setAutoRemind(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${autoRemind ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoRemind ? 'translate-x-5' : ''}`} />
              </button>
            </label>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t.preview_saving : (isEdit ? t.form_update_loan : t.form_save_loan)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
