'use client'

import { EXPENSE_CATEGORY_MAP } from '@/lib/constants/categories'
import type { ExpenseCategory } from '@/lib/types/app.types'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { getExpenseCategoryLabel } from '@/lib/utils/category-i18n'

interface CategorySpend {
  category: ExpenseCategory
  amount: number
}

interface Props {
  items: CategorySpend[]
  total: number
}

export default function SpendingBreakdown({ items, total }: Props) {
  const { t, lang } = useLang()
  if (items.length === 0) return null

  return (
    <section className="px-4 mt-6">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {t.dashboard_spending}
      </h2>
      <div className="space-y-2.5">
        {items.map(({ category, amount }) => {
          const cat = EXPENSE_CATEGORY_MAP[category]
          if (!cat) return null
          const pct = total > 0 ? (amount / total) * 100 : 0
          return (
            <div key={category}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{cat.icon}</span>
                  <span className="text-sm">{getExpenseCategoryLabel(category, lang)}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">RM {amount.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{pct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
