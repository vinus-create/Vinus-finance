'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { EXPENSE_CATEGORIES } from '@/lib/constants/categories'
import type { ExpenseCategory } from '@/lib/types/app.types'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { getExpenseCategoryLabel } from '@/lib/utils/category-i18n'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  month: number
  /** Pre-selected category (for editing an existing budget) */
  initialCategory?: ExpenseCategory
  initialAmount?: number
}

export default function SetBudgetSheet({ open, onOpenChange, year, month, initialCategory, initialAmount }: Props) {
  const router = useRouter()
  const { t, lang } = useLang()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<ExpenseCategory>(initialCategory ?? 'food' as ExpenseCategory)
  const [amount, setAmount] = useState(initialAmount ? initialAmount.toFixed(2) : '')

  // Show only common categories that make sense to budget
  const BUDGETABLE = EXPENSE_CATEGORIES.filter(c => !['epf_kwsp', 'socso_perkeso', 'income_tax', 'savings', 'investment'].includes(c.value))

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError(t.form_err_budget); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)

      const { error: upsertError } = await supabase
        .from('budgets')
        .upsert({
          user_id: user.id,
          period_year: year,
          period_month: month,
          expense_category: category,
          budget_amount: amt,
          currency: 'MYR',
        }, { onConflict: 'user_id,period_year,period_month,expense_category' })

      if (upsertError) throw new Error(upsertError.message)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{t.form_add_budget}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6 mt-3 space-y-4">
          {/* Category picker */}
          <div className="space-y-2">
            <Label className="text-xs">{t.form_category}</Label>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-0.5">
              {BUDGETABLE.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value as ExpenseCategory)}
                  className={`p-2 rounded-xl text-xs flex flex-col items-center gap-1 border transition-colors ${
                    category === c.value
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <span className="text-lg">{c.icon}</span>
                  <span className="text-center leading-tight">{getExpenseCategoryLabel(c.value, lang)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_budget_amount}</Label>
            <Input
              type="number"
              step="10"
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t.preview_saving : t.form_save_budget}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
