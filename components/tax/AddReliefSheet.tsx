'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { RELIEF_META } from '@/lib/utils/tax-calc'
import { RELIEF_GROUPS, getReliefI18n } from '@/lib/utils/tax-relief-i18n'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  taxForm: 'BE' | 'B'
  existing: { category: string; claimed_amount: number }[]
}

const GROUP_KEY_MAP: Record<string, keyof import('@/lib/i18n').Translations> = {
  individual: 'relief_group_individual',
  insurance:  'relief_group_insurance',
  medical:    'relief_group_medical',
  education:  'relief_group_education',
  lifestyle:  'relief_group_lifestyle',
  family:     'relief_group_family',
  housing:    'relief_group_housing',
}

export default function AddReliefSheet({ open, onOpenChange, year, taxForm, existing }: Props) {
  const router = useRouter()
  const { t, lang } = useLang()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')

  const existingMap = Object.fromEntries(existing.map(e => [e.category, e.claimed_amount]))
  const capMap = Object.fromEntries(RELIEF_META.map(r => [r.category, r.cap]))

  const selectedCap = category ? capMap[category] ?? null : null
  const alreadyClaimed = category ? (existingMap[category] ?? 0) : 0
  const remaining = selectedCap != null ? selectedCap - alreadyClaimed : null

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!category) { setError(t.form_err_relief_cat); return }
    if (!amt || amt <= 0) { setError(t.form_err_relief_amount); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)

      const { error: upsertError } = await supabase
        .from('tax_reliefs')
        .upsert({
          user_id: user.id,
          assessment_year: year,
          tax_form: taxForm,
          category,
          claimed_amount: amt,
          max_allowed: selectedCap ?? null,
        }, { onConflict: 'user_id,assessment_year,category' })

      if (upsertError) throw new Error(upsertError.message)
      setCategory('')
      setAmount('')
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
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92dvh] overflow-y-auto">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{t.form_add_relief} YA {year}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6 mt-3 space-y-4">

          {/* Grouped category picker */}
          <div className="space-y-2">
            <Label className="text-xs">{t.form_relief_type}</Label>
            <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-0.5">
              {RELIEF_GROUPS.map(group => {
                const groupLabel = t[GROUP_KEY_MAP[group.groupKey] as keyof typeof t] as string
                const items = group.categories.map(cat => {
                  const i18n = getReliefI18n(cat, lang)
                  const cap = capMap[cat] ?? null
                  const claimed = existingMap[cat] ?? 0
                  const isFull = cap != null && claimed >= cap
                  return { cat, i18n, cap, isFull }
                })

                return (
                  <div key={group.groupKey}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
                      {groupLabel}
                    </p>
                    <div className="space-y-1">
                      {items.map(({ cat, i18n, cap, isFull }) => (
                        <button
                          key={cat}
                          onClick={() => !isFull && setCategory(cat)}
                          disabled={isFull}
                          className={`w-full p-2.5 rounded-xl text-left border transition-colors text-sm ${
                            category === cat
                              ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/40'
                              : isFull
                              ? 'bg-muted/50 border-border opacity-40 cursor-not-allowed'
                              : 'border-border hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium leading-tight">{i18n.label}</span>
                            {cap != null && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {isFull ? t.form_cap_full : `${t.form_max} RM ${cap.toLocaleString()}`}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {i18n.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected category: official details + amount input */}
          {category && (() => {
            const selectedI18n = getReliefI18n(category, lang)
            return (
              <div className="space-y-3">
                {/* Official details panel */}
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    📋 {selectedI18n.label}
                  </p>
                  <ul className="space-y-1">
                    {selectedI18n.details.map((point, i) => (
                      <li key={i} className="flex gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                        <span className="shrink-0 text-emerald-500 mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {t.form_claim_amount}
                    {remaining != null && (
                      <span className="text-muted-foreground ml-2">
                        — {t.form_remaining_cap} RM {remaining.toFixed(2)}
                      </span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={remaining != null ? String(remaining) : '0'}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
            )
          })()}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
            onClick={handleSave}
            disabled={saving || !category}
          >
            {saving ? t.preview_saving : t.form_save_relief}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
