'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import BudgetRow from './BudgetRow'
import SetBudgetSheet from './SetBudgetSheet'
import EmptyState from '@/components/ui/EmptyState'
import { EXPENSE_CATEGORY_MAP } from '@/lib/constants/categories'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { ExpenseCategory } from '@/lib/types/app.types'
import { useFabAction } from '@/lib/hooks/useFabAction'

interface BudgetItem {
  id: string
  category: ExpenseCategory
  budgetAmount: number
  spentAmount: number
}

interface Props {
  year: number
  month: number
  budgetList: BudgetItem[]
}

export default function BudgetsClient({ year, month, budgetList: initial }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const [budgets, setBudgets] = useState<BudgetItem[]>(initial)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<BudgetItem | null>(null)
  useFabAction(() => { setEditItem(null); setAddOpen(true) })

  async function handleDelete(item: BudgetItem) {
    if (!confirm(`删除「${item.category}」预算？`)) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('budgets').delete().eq('id', item.id)
      if (error) throw error
      setBudgets(prev => prev.filter(b => b.id !== item.id))
      toast.success('预算已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  function handleEdit(item: BudgetItem) {
    setEditItem(item)
    setAddOpen(true)
  }

  function handleSheetClose(open: boolean) {
    setAddOpen(open)
    if (!open) {
      setEditItem(null)
      router.refresh()
    }
  }

  return (
    <>
      <div className="px-4 mt-4 space-y-1 pb-24">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t.budgets_this_month}
        </p>

        {budgets.length === 0 ? (
          <EmptyState emoji="📊" title={t.empty_budgets} body={t.empty_budgets_hint} />
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              {budgets.map(b => {
                const cat = EXPENSE_CATEGORY_MAP[b.category]
                return cat ? (
                  <BudgetRow
                    key={b.category}
                    cat={cat}
                    budgetAmount={b.budgetAmount}
                    spentAmount={b.spentAmount}
                    onEdit={() => handleEdit(b)}
                    onDelete={() => handleDelete(b)}
                  />
                ) : null
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <button
        onClick={() => { setEditItem(null); setAddOpen(true) }}
        className="fixed bottom-20 right-4 flex items-center gap-1.5 px-5 h-12 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 text-white text-sm font-semibold active:scale-95 transition-transform z-40"
      >
        {t.budgets_set_btn}
      </button>

      <SetBudgetSheet
        open={addOpen}
        onOpenChange={handleSheetClose}
        year={year}
        month={month}
        initialCategory={editItem?.category}
        initialAmount={editItem?.budgetAmount}
      />
    </>
  )
}
