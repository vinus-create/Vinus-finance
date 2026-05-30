'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { calcEarlySettlement } from '@/lib/utils/loan-math'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { Loan } from '@/lib/types/app.types'

interface Props {
  loan: Loan
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EarlySettlementSheet({ loan, open, onOpenChange }: Props) {
  const { t } = useLang()

  const remainingMonths = loan.remaining_months ?? 0
  const result = calcEarlySettlement(
    loan.outstanding_balance,
    loan.principal_amount,
    loan.monthly_payment,
    loan.tenure_months,
    remainingMonths,
    loan.interest_method,
  )

  const isFlat = result.method === 'flat'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{t.loan_settlement_title}</SheetTitle>
          <p className="text-sm text-muted-foreground">{loan.name}</p>
        </SheetHeader>

        <div className="px-4 pb-8 space-y-3 mt-4">
          {/* Main settlement amount */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">
              {t.loan_settlement_amount}
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              RM {result.settlementAmount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Detail rows */}
          <div className="space-y-2 p-3 rounded-xl bg-muted">
            <Row label={t.loan_balance_label} value={`RM ${result.outstandingPrincipal.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`} />
            <Row label={t.loan_settlement_remaining} value={`${remainingMonths}`} />
            {isFlat && (
              <>
                <div className="border-t border-border" />
                <Row label={t.loan_settlement_rebate} value={`RM ${result.rebate.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`} accent />
                <Row label={t.loan_settlement_saved} value={`RM ${result.interestSaved.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`} accent />
              </>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {isFlat ? t.loan_settlement_note_flat : t.loan_settlement_note_reducing}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${accent ? 'text-emerald-600' : ''}`}>{value}</span>
    </div>
  )
}
