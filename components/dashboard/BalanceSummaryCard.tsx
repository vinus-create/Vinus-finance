'use client'

import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface BalanceSummaryCardProps {
  totalIncome: number
  totalExpense: number
  month: string
}

function formatMYR(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function BalanceSummaryCard({
  totalIncome,
  totalExpense,
  month,
}: BalanceSummaryCardProps) {
  const balance = totalIncome - totalExpense
  const { t } = useLang()

  return (
    <div className="px-4 pt-4 space-y-3">
      {/* Net balance */}
      <Card className="bg-emerald-600 text-white border-0 shadow-lg">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 opacity-80" />
            <span className="text-sm opacity-80">{t.balance_net} — {month}</span>
          </div>
          <p className="text-3xl font-bold tracking-tight">
            {balance >= 0 ? '+' : ''}{formatMYR(balance)}
          </p>
        </CardContent>
      </Card>

      {/* Income vs Expense row */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 rounded-full bg-emerald-100">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
              </div>
              <span className="text-xs text-muted-foreground">{t.balance_income}</span>
            </div>
            <p className="text-lg font-semibold text-emerald-600">{formatMYR(totalIncome)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 rounded-full bg-red-100">
                <TrendingDown className="w-3 h-3 text-red-500" />
              </div>
              <span className="text-xs text-muted-foreground">{t.balance_expense}</span>
            </div>
            <p className="text-lg font-semibold text-red-500">{formatMYR(totalExpense)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
