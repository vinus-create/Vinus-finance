'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { StockHolding } from '@/lib/types/app.types'
import type { PriceData } from './StocksClient'

const COLORS = ['#10b981', '#6366f1', '#f97316', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#14b8a6']

interface Props {
  holdings: StockHolding[]
  prices: Record<string, PriceData | null>
}

export default function PortfolioChart({ holdings, prices }: Props) {
  const { t } = useLang()

  const data = holdings
    .map(h => ({
      name: h.ticker,
      value: Math.round((h.shares * (prices[h.ticker]?.price ?? h.avg_cost_price)) * 100) / 100,
    }))
    .filter(d => d.value > 0)

  if (data.length < 2) return null

  return (
    <div className="h-44 bg-card border border-border rounded-2xl">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={68}
            innerRadius={32}
            dataKey="value"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
            formatter={(v) => [`$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, t.stocks_market_value]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
