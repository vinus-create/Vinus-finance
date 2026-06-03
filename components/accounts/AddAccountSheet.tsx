'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { ACCOUNT_TYPE_CONFIG, MY_INSTITUTIONS } from '@/lib/constants/accounts'
import type { Account, AccountType } from '@/lib/types/app.types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account
}

function blank() {
  return {
    name: '',
    account_type: 'bank' as AccountType,
    institution: '',
    account_number: '',
    balance: '',
    due_day: '',
    include_in_net_worth: true,
    notes: '',
  }
}

function toForm(a: Account) {
  return {
    name: a.name,
    account_type: a.account_type,
    institution: a.institution ?? '',
    account_number: a.account_number ?? '',
    balance: String(a.balance),
    due_day: a.due_day ? String(a.due_day) : '',
    include_in_net_worth: a.include_in_net_worth,
    notes: a.notes ?? '',
  }
}

const ACCOUNT_TYPES: AccountType[] = ['bank', 'ewallet', 'investment', 'cash', 'credit_card', 'other']

export default function AddAccountSheet({ open, onOpenChange, account }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const isEdit = !!account
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(account ? toForm(account) : blank())
  const [showInstitutions, setShowInstitutions] = useState(false)
  const [autoRemind, setAutoRemind] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(account ? toForm(account) : blank())
      setShowInstitutions(false)
      setAutoRemind(false)
    }
  }, [open, account])

  function set<K extends keyof ReturnType<typeof blank>>(field: K, value: ReturnType<typeof blank>[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Filter institution presets by selected account type
  const institutionPresets = MY_INSTITUTIONS.filter(i => i.type === form.account_type)

  const typeLabel: Record<AccountType, string> = {
    bank:        t.account_type_bank,
    ewallet:     t.account_type_ewallet,
    investment:  t.account_type_investment,
    cash:        t.account_type_cash,
    credit_card: t.account_type_credit,
    other:       t.account_type_other,
  }

  async function handleSave() {
    if (!form.name.trim()) { setError(t.form_err_account_name); return }
    const balance = parseFloat(form.balance || '0')

    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)

      const dueDay = form.due_day ? parseInt(form.due_day) : null

      const payload = {
        name: form.name.trim(),
        account_type: form.account_type,
        institution: form.institution.trim() || null,
        account_number: form.account_number.trim() || null,
        balance,
        currency: 'MYR',
        include_in_net_worth: form.include_in_net_worth,
        due_day: dueDay,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (isEdit && account) {
        const { error: e } = await supabase.from('accounts').update(payload).eq('id', account.id)
        if (e) throw new Error(e.message)
      } else {
        const { error: e } = await supabase.from('accounts').insert({ ...payload, user_id: user.id, is_active: true })
        if (e) throw new Error(e.message)
      }

      // 🔔 Auto-remind for credit card with negative balance
      if (autoRemind && form.account_type === 'credit_card' && balance < 0 && dueDay) {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        const lastDay = new Date(year, month, 0).getDate()
        const clampedDay = Math.min(dueDay, lastDay)
        // If due day already passed this month, use next month
        const dueThisMonth = new Date(year, month - 1, clampedDay)
        const useNextMonth = dueThisMonth <= now
        const targetMonth = useNextMonth ? month + 1 : month
        const targetYear = targetMonth > 12 ? year + 1 : year
        const normalizedMonth = targetMonth > 12 ? 1 : targetMonth
        const lastDayTarget = new Date(targetYear, normalizedMonth, 0).getDate()
        const finalDay = Math.min(clampedDay, lastDayTarget)
        const dueDate = `${targetYear}-${String(normalizedMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`

        await supabase.from('reminders').insert({
          user_id: user.id,
          title: `${form.name.trim()} 信用卡还款`,
          amount: Math.abs(balance),
          currency: 'MYR',
          due_date: dueDate,
          frequency: 'monthly',
          status: 'active',
          notify_push: true,
          notify_email: false,
          days_before: 3,
        })
      }

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
          <SheetTitle>{isEdit ? t.form_edit_account : t.form_add_account}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 mt-3 space-y-4">
          {/* Account Type */}
          <div className="space-y-2">
            <Label className="text-xs">{t.form_account_type_label}</Label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map(type => {
                const cfg = ACCOUNT_TYPE_CONFIG[type]
                return (
                  <button
                    key={type}
                    onClick={() => {
                      set('account_type', type)
                      set('institution', '') // reset institution on type change
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs border font-medium transition-colors ${
                      form.account_type === type
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span>{cfg.emoji}</span>
                    <span className="truncate">{typeLabel[type]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Institution quick-pick */}
          {institutionPresets.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_institution}</Label>
              <div className="flex flex-wrap gap-2">
                {institutionPresets.map(inst => (
                  <button
                    key={inst.name}
                    onClick={() => {
                      set('institution', inst.name)
                      if (!form.name) set('name', inst.name)
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.institution === inst.name
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'border-border bg-muted hover:bg-muted/70'
                    }`}
                  >
                    {inst.emoji} {inst.name}
                  </button>
                ))}
              </div>
              <Input
                placeholder={t.form_institution}
                value={form.institution}
                onChange={e => set('institution', e.target.value)}
                className="h-9 text-sm mt-1"
              />
            </div>
          )}

          {/* Account name */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_account_name}</Label>
            <Input
              placeholder={t.form_account_name_placeholder}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="h-10"
            />
          </div>

          {/* Balance + Account number */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_balance_label} (RM)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.balance}
                onChange={e => set('balance', e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_account_number}</Label>
              <Input
                type="text"
                placeholder="e.g. 1234567890"
                value={form.account_number}
                onChange={e => set('account_number', e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Credit card extra fields */}
          {form.account_type === 'credit_card' && (
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground bg-muted px-3 py-2 rounded-lg">
                💡 如欠款请填负数余额，例如 -2500
              </p>

              {/* Due date */}
              <div className="space-y-1.5">
                <Label className="text-xs">每月还款日（1–31）</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="例：15"
                  value={form.due_day}
                  onChange={e => set('due_day', e.target.value)}
                  className="h-10 w-32"
                />
              </div>

              {/* Auto-remind toggle — only shown if balance negative and due_day set */}
              {parseFloat(form.balance || '0') < 0 && form.due_day && (
                <label className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">🔔 添加至账单提醒</p>
                    <p className="text-xs text-muted-foreground">
                      每月 {form.due_day} 日前 3 天提醒还款 RM {Math.abs(parseFloat(form.balance || '0')).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoRemind(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${autoRemind ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoRemind ? 'translate-x-5' : ''}`} />
                  </button>
                </label>
              )}
            </div>
          )}

          {/* Include in net worth toggle */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-muted cursor-pointer">
            <span className="text-sm">{t.form_include_net_worth}</span>
            <div
              onClick={() => set('include_in_net_worth', !form.include_in_net_worth)}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.include_in_net_worth ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.include_in_net_worth ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t.preview_saving : (isEdit ? t.form_update_account : t.form_save_account)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
