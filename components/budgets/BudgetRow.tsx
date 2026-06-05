'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CategoryMeta } from '@/lib/constants/categories'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { getExpenseCategoryLabel } from '@/lib/utils/category-i18n'

interface Props {
  cat: CategoryMeta
  budgetAmount: number
  spentAmount: number
  onEdit?: () => void
  onDelete?: () => void
}

export default function BudgetRow({ cat, budgetAmount, spentAmount, onEdit, onDelete }: Props) {
  const { t, lang } = useLang()
  const pct = budgetAmount > 0 ? Math.min((spentAmount / budgetAmount) * 100, 100) : 0
  const over = spentAmount > budgetAmount
  const warn = pct >= 80 && !over

  return (
    <div className="space-y-1.5 py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{cat.icon}</span>
          <p className="text-sm font-medium">{getExpenseCategoryLabel(cat.value, lang)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className={cn('text-sm font-semibold', over ? 'text-red-500' : warn ? 'text-orange-500' : '')}>
              RM {spentAmount.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">/ RM {budgetAmount.toFixed(2)}</p>
          </div>
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors" aria-label="编辑">
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/30 transition-colors" aria-label="删除">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            over ? 'bg-red-500' : warn ? 'bg-orange-400' : 'bg-emerald-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={cn('text-xs', over ? 'text-red-500' : 'text-muted-foreground')}>
        {over
          ? `${t.budget_over_by} ${(spentAmount - budgetAmount).toFixed(2)}`
          : `${Math.round(pct)}${t.budget_pct_used}`}
      </p>
    </div>
  )
}
