'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { calcTaxSummary, type TaxSummary } from '@/lib/utils/tax-calc'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  /** Pre-filled from DB reliefs so the estimator uses current year data */
  reliefs: { category: string; claimed_amount: number }[]
  prefillIncome?: number
}

function fmt(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function TaxEstimator({ reliefs, prefillIncome }: Props) {
  const { t } = useLang()
  const [income, setIncome] = useState(prefillIncome ? String(prefillIncome) : '')
  const [result, setResult] = useState<TaxSummary | null>(null)

  function handleCalc() {
    const gross = parseFloat(income)
    if (!gross || gross <= 0) return
    setResult(calcTaxSummary(gross, reliefs))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">{t.tax_income_label}</Label>
        <Input
          type="number"
          placeholder="60000"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          {t.tax_income_hint}
        </p>
      </div>

      <Button
        className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
        onClick={handleCalc}
      >
        {t.tax_calc_btn}
      </Button>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-0 bg-muted">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">{t.tax_gross_income}</p>
                <p className="text-sm font-bold mt-0.5">{fmt(result.grossIncome)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-muted">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">{t.tax_total_reliefs}</p>
                <p className="text-sm font-bold mt-0.5 text-emerald-600">- {fmt(result.totalRelief)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-muted">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">{t.tax_chargeable}</p>
                <p className="text-sm font-bold mt-0.5">{fmt(result.chargeableIncome)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-orange-50 dark:bg-orange-950/40">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">{t.tax_estimated}</p>
                <p className="text-sm font-bold mt-0.5 text-orange-500">{fmt(result.estimatedTax)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 bg-emerald-50 dark:bg-emerald-950/40">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{t.tax_effective_rate}</p>
              <p className="text-2xl font-bold text-emerald-600 mt-0.5">
                {result.effectiveRate.toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.tax_monthly_pcb} {fmt(result.estimatedTax / 12)} {t.tax_per_month}
              </p>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            {t.tax_disclaimer}
          </p>
        </div>
      )}
    </div>
  )
}
