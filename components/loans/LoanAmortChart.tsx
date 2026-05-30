'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { calcFullAmortization } from '@/lib/utils/loan-math'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { Loan } from '@/lib/types/app.types'

interface Props {
  loan: Loan
}

function fmtRM(n: number) {
  if (n >= 1000) return `RM ${(n / 1000).toFixed(0)}k`
  return `RM ${n.toFixed(0)}`
}

interface ChartPoint {
  month: number
  balance: number
  cumPrincipal: number
  cumInterest: number
  principal: number
  interest: number
}

function downsample(rows: ChartPoint[], step: number): ChartPoint[] {
  return rows.filter((_, i) => i % step === 0 || i === rows.length - 1)
}

export default function LoanAmortChart({ loan }: Props) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)

  const rows = useMemo(() => {
    return calcFullAmortization(
      loan.principal_amount,
      loan.interest_rate,
      loan.tenure_months,
      loan.interest_method,
    )
  }, [loan.principal_amount, loan.interest_rate, loan.tenure_months, loan.interest_method])

  // Build chart data: cumulative principal paid, cumulative interest paid, balance
  const chartData = useMemo((): ChartPoint[] => {
    let cumPrincipal = 0
    let cumInterest = 0
    const step = loan.tenure_months > 120 ? 3 : loan.tenure_months > 60 ? 2 : 1
    const points: ChartPoint[] = rows.map((r) => {
      cumPrincipal += r.principal
      cumInterest += r.interest
      return {
        month: r.month,
        balance: r.balance,
        cumPrincipal: Math.round(cumPrincipal),
        cumInterest: Math.round(cumInterest),
        principal: r.principal,
        interest: r.interest,
      }
    })
    return step > 1 ? downsample(points, step) : points
  }, [rows, loan.tenure_months])

  // Months-paid marker for current position
  const monthsPaid = loan.tenure_months - (loan.remaining_months ?? loan.tenure_months)

  const totalInterest = rows.reduce((s, r) => s + r.interest, 0)
  const totalPrincipal = loan.principal_amount
  const interestRatio = (totalInterest / (totalPrincipal + totalInterest) * 100).toFixed(1)

  // i18n labels
  const labelBalance   = lang === 'zh' ? '余额' : lang === 'ms' ? 'Baki' : 'Balance'
  const labelPrincipal = lang === 'zh' ? '累计本金' : lang === 'ms' ? 'Prinsipal' : 'Principal Paid'
  const labelInterest  = lang === 'zh' ? '累计利息' : lang === 'ms' ? 'Faedah' : 'Interest Paid'
  const labelMonth     = lang === 'zh' ? '第' : lang === 'ms' ? 'Bln' : 'Mo'
  const labelMonthSuffix = lang === 'zh' ? '月' : ''
  const labelToggle    = open
    ? (lang === 'zh' ? '收起 ▲' : lang === 'ms' ? 'Tutup ▲' : 'Hide ▲')
    : (lang === 'zh' ? '本金 vs 利息详情 ▼' : lang === 'ms' ? 'Jadual Bayaran ▼' : 'Principal vs Interest ▼')

  return (
    <div className="border-t border-border pt-2 mt-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-between py-1 transition-colors"
      >
        <span>📊 {labelToggle}</span>
        {!open && totalInterest > 0 && (
          <span className="text-orange-500 font-medium">
            {lang === 'zh' ? `利息占 ${interestRatio}%` : lang === 'ms' ? `Faedah ${interestRatio}%` : `${interestRatio}% interest`}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Summary pills */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <p className="text-[10px] text-muted-foreground">{labelPrincipal}</p>
              <p className="text-xs font-bold text-emerald-600">
                RM {totalPrincipal.toLocaleString('en-MY', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30">
              <p className="text-[10px] text-muted-foreground">{labelInterest}</p>
              <p className="text-xs font-bold text-orange-500">
                RM {Math.round(totalInterest).toLocaleString('en-MY')}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted">
              <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '利息比例' : lang === 'ms' ? 'Nisbah' : 'Int. Ratio'}</p>
              <p className="text-xs font-bold">{interestRatio}%</p>
            </div>
          </div>

          {/* Area chart */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`gradBalance-${loan.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`gradInterest-${loan.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />

                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9 }}
                  tickFormatter={m => `${labelMonth}${m}${labelMonthSuffix}`}
                  interval="preserveStartEnd"
                  stroke="currentColor"
                  strokeOpacity={0.2}
                />
                <YAxis
                  tick={{ fontSize: 9 }}
                  tickFormatter={fmtRM}
                  width={44}
                  stroke="currentColor"
                  strokeOpacity={0.2}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  formatter={(value) => [
                    `RM ${Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`,
                  ]}
                  labelFormatter={m => `${labelMonth} ${m}${labelMonthSuffix}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                  iconType="circle"
                  iconSize={8}
                />

                {/* Balance line */}
                <Area
                  type="monotone"
                  dataKey="balance"
                  name={labelBalance}
                  stroke="#10b981"
                  strokeWidth={2}
                  fill={`url(#gradBalance-${loan.id})`}
                  dot={false}
                  activeDot={{ r: 3 }}
                />

                {/* Cumulative interest */}
                <Area
                  type="monotone"
                  dataKey="cumInterest"
                  name={labelInterest}
                  stroke="#f97316"
                  strokeWidth={2}
                  fill={`url(#gradInterest-${loan.id})`}
                  dot={false}
                  activeDot={{ r: 3 }}
                />

                {/* Months-paid reference line (render as a tiny rect if > 0) */}
                {monthsPaid > 0 && chartData.find(d => d.month === monthsPaid) && (
                  <Area
                    type="monotone"
                    dataKey="cumPrincipal"
                    name={labelPrincipal}
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    fill="none"
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Current position note */}
          {monthsPaid > 0 && (
            <p className="text-[10px] text-center text-muted-foreground">
              {lang === 'zh'
                ? `已还 ${monthsPaid} 个月，剩余 ${loan.remaining_months} 个月`
                : lang === 'ms'
                ? `${monthsPaid} bulan dibayar, ${loan.remaining_months} bulan lagi`
                : `${monthsPaid} months paid, ${loan.remaining_months} remaining`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
