'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { calcByMethod, formatRM, type CalcResult } from '@/lib/utils/loan-math'
import { useLang } from '@/lib/i18n/LanguageProvider'

function ResultCard({ result, isIslamic }: { result: CalcResult; isIslamic: boolean }) {
  const { t } = useLang()
  const profitLabel = isIslamic ? t.calc_profit : t.calc_interest
  return (
    <div className="space-y-3 mt-2">
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 bg-emerald-50 dark:bg-emerald-950/40">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">{t.calc_monthly}</p>
            <p className="text-base font-bold text-emerald-600 mt-0.5">
              {formatRM(result.monthly)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">{t.calc_total_pay}</p>
            <p className="text-base font-bold mt-0.5">
              {formatRM(result.totalPayment)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">{profitLabel}</p>
            <p className="text-base font-bold text-orange-500 mt-0.5">
              {formatRM(result.totalInterest)}
            </p>
          </CardContent>
        </Card>
      </div>

      {result.rows.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            {t.calc_schedule}
          </p>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">{t.calc_col_month}</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">{t.calc_col_payment}</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">{t.calc_col_principal}</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">{profitLabel}</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">{t.calc_col_balance}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.month} className="border-t border-border">
                    <td className="px-2 py-1.5 text-muted-foreground">{row.month}</td>
                    <td className="px-2 py-1.5 text-right">{formatRM(row.payment)}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-600">{formatRM(row.principal)}</td>
                    <td className="px-2 py-1.5 text-right text-orange-500">{formatRM(row.interest)}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{formatRM(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CalcForm({ islamicMode }: { islamicMode: boolean }) {
  const { t } = useLang()
  const [principal, setPrincipal] = useState('300000')
  const [rate, setRate] = useState('4.0')
  const [years, setYears] = useState('30')
  const [method, setMethod] = useState(islamicMode ? 'islamic_bba' : 'reducing_balance')
  const [result, setResult] = useState<CalcResult | null>(null)

  const CONVENTIONAL_METHODS = [
    { value: 'reducing_balance', label: t.method_reducing },
    { value: 'flat_rate',        label: t.method_flat },
  ]

  const ISLAMIC_METHODS = [
    { value: 'islamic_bba',       label: `${t.method_bba} (Bai Bithaman Ajil)` },
    { value: 'islamic_murabahah', label: t.method_murabahah },
    { value: 'islamic_tawarruq',  label: t.method_tawarruq },
    { value: 'zero_interest',     label: t.method_zero },
  ]

  const methods = islamicMode ? ISLAMIC_METHODS : CONVENTIONAL_METHODS
  const rateLabel = islamicMode ? t.form_profit_rate : t.form_interest_rate

  useMemo(() => {
    setMethod(islamicMode ? 'islamic_bba' : 'reducing_balance')
  }, [islamicMode])

  function handleCalc() {
    const P = parseFloat(principal)
    const r = parseFloat(rate)
    const n = parseFloat(years) * 12
    if (!P || !n) return
    setResult(calcByMethod(P, r, n, method))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t.calc_amount}</Label>
          <Input
            type="number"
            placeholder="300000"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{rateLabel} {t.form_per_year}</Label>
          <Input
            type="number"
            step="0.05"
            placeholder="4.0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t.calc_tenure_years}</Label>
        <Input
          type="number"
          placeholder="30"
          value={years}
          onChange={(e) => setYears(e.target.value)}
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t.calc_method_label}</Label>
        <div className="space-y-2">
          {methods.map((m) => (
            <label
              key={m.value}
              className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-muted"
            >
              <input
                type="radio"
                name="method"
                value={m.value}
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
                className="accent-emerald-500"
              />
              <span className="text-sm">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Button
        className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
        onClick={handleCalc}
      >
        {t.calc_btn}
      </Button>

      {result && <ResultCard result={result} isIslamic={islamicMode} />}
    </div>
  )
}

export default function LoanCalculator() {
  const { t } = useLang()
  return (
    <div className="space-y-4">
      <Tabs defaultValue="konvensional">
        <TabsList className="w-full grid grid-cols-2 mb-4">
          <TabsTrigger value="konvensional">{t.calc_conventional}</TabsTrigger>
          <TabsTrigger value="islamik">{t.calc_islamic}</TabsTrigger>
        </TabsList>
        <TabsContent value="konvensional">
          <CalcForm islamicMode={false} />
        </TabsContent>
        <TabsContent value="islamik">
          <CalcForm islamicMode={true} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
