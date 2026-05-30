'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { formatRM } from '@/lib/utils/loan-math'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { Loan } from '@/lib/types/app.types'
import AddLoanSheet from './AddLoanSheet'
import MakePaymentSheet from './MakePaymentSheet'
import EarlySettlementSheet from './EarlySettlementSheet'
import LoanAmortChart from './LoanAmortChart'

const LOAN_TYPE_ICON: Record<string, string> = {
  home_loan:     '🏠',
  car_loan:      '🚗',
  personal_loan: '💳',
  business_loan: '🏪',
  credit_card:   '💳',
  bnpl:          '🛍️',
  other_loan:    '📝',
}

interface Props {
  loan: Loan
}

export default function LoanCard({ loan }: Props) {
  const router = useRouter()
  const { t } = useLang()

  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const LOAN_TYPE_LABEL: Record<string, string> = {
    home_loan:     t.loan_type_home,
    car_loan:      t.loan_type_car,
    personal_loan: t.loan_type_personal,
    business_loan: t.loan_type_business,
    credit_card:   t.loan_type_credit,
    bnpl:          t.loan_type_bnpl,
    other_loan:    t.loan_type_other,
  }

  const icon = LOAN_TYPE_ICON[loan.loan_type] ?? '📝'
  const label = LOAN_TYPE_LABEL[loan.loan_type] ?? t.loan_type_other
  const paidPercent = loan.principal_amount > 0
    ? Math.round(((loan.principal_amount - loan.outstanding_balance) / loan.principal_amount) * 100)
    : 0
  const paidAmount = loan.principal_amount - loan.outstanding_balance

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('loans').update({ is_active: false }).eq('id', loan.id)
      if (error) throw new Error(error.message)
      toast.success(loan.name)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5">{icon}</span>
              <div>
                <p className="font-medium text-sm">{loan.name}</p>
                <p className="text-xs text-muted-foreground">
                  {loan.lender_name ?? label}
                  {loan.is_islamic && ` • ${t.method_islamic_badge}`}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold">{formatRM(loan.outstanding_balance)}</p>
              <p className="text-xs text-muted-foreground">{t.loan_balance_label}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{t.loan_paid_pct} {paidPercent}%</span>
              <span>{formatRM(paidAmount)} / {formatRM(loan.principal_amount)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(paidPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Footer stats */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <p className="text-[10px] text-muted-foreground">{t.loan_monthly_label}</p>
              <p className="text-xs font-semibold">{formatRM(loan.monthly_payment)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{t.loan_remaining_months_label}</p>
              <p className="text-xs font-semibold">{loan.remaining_months ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{t.loan_next_payment_label}</p>
              <p className="text-xs font-semibold">{loan.next_payment_date ?? '—'}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-8"
              onClick={() => setPayOpen(true)}
            >
              💰 {t.loan_pay_btn}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() => setSettlementOpen(true)}
            >
              🏁 {t.loan_settlement_btn}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() => setEditOpen(true)}
            >
              ✏️ {t.loan_edit_btn}
            </Button>
            {confirmDelete ? (
              <Button
                size="sm"
                variant="destructive"
                className="text-xs h-8"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? t.loan_deleting : '⚠️ ' + t.confirm}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => setConfirmDelete(true)}
              >
                🗑️ {t.delete}
              </Button>
            )}
          </div>

          {/* Delete confirmation text */}
          {confirmDelete && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t.loan_delete_confirm}</span>
              <button
                className="text-muted-foreground underline ml-2"
                onClick={() => setConfirmDelete(false)}
              >
                {t.cancel}
              </button>
            </div>
          )}

          {/* Amortization chart — collapsible */}
          <LoanAmortChart loan={loan} />
        </CardContent>
      </Card>

      {/* Sheets */}
      <AddLoanSheet loan={loan} open={editOpen} onOpenChange={setEditOpen} />
      <MakePaymentSheet loan={loan} open={payOpen} onOpenChange={setPayOpen} />
      <EarlySettlementSheet loan={loan} open={settlementOpen} onOpenChange={setSettlementOpen} />
    </>
  )
}
