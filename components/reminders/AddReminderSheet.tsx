'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { Reminder } from '@/lib/types/app.types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder?: Reminder   // present → edit mode
}

function blankForm() {
  return { title: '', description: '', amount: '', due_date: '', frequency: 'monthly', notify_push: false, notify_email: false, days_before: 1 }
}

function reminderToForm(r: Reminder) {
  return {
    title: r.title,
    description: r.description ?? '',
    amount: r.amount != null ? String(r.amount) : '',
    due_date: r.due_date,
    frequency: r.frequency,
    notify_push: r.notify_push,
    notify_email: r.notify_email,
    days_before: r.days_before ?? 1,
  }
}

export default function AddReminderSheet({ open, onOpenChange, reminder }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const isEdit = !!reminder
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(reminder ? reminderToForm(reminder) : blankForm())

  // Sync form when sheet opens / reminder changes
  useEffect(() => {
    if (open) setForm(reminder ? reminderToForm(reminder) : blankForm())
  }, [open, reminder])

  const FREQ_OPTIONS = [
    { value: 'once',    label: t.freq_once },
    { value: 'weekly',  label: t.freq_weekly },
    { value: 'monthly', label: t.freq_monthly },
    { value: 'yearly',  label: t.freq_yearly },
  ]

  const TEMPLATES = [
    { title: t.tmpl_tnb,      description: t.tmpl_tnb_desc },
    { title: t.tmpl_internet, description: t.tmpl_internet_desc },
    { title: t.tmpl_rent,     description: t.tmpl_rent_desc },
    { title: t.tmpl_car_loan, description: t.tmpl_car_loan_desc },
    { title: t.tmpl_insurance,description: t.tmpl_insurance_desc },
    { title: t.tmpl_tax,      description: t.tmpl_tax_desc },
  ]

  function set(field: string, value: string | boolean | number) {
    setForm(f => ({ ...f, [field]: field === 'days_before' ? Number(value) : value }))
  }

  async function handleSave() {
    if (!form.title.trim()) { setError(t.form_err_reminder_title); return }
    if (!form.due_date) { setError(t.form_err_reminder_date); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        amount: form.amount ? parseFloat(form.amount) : null,
        currency: 'MYR',
        due_date: form.due_date,
        frequency: form.frequency,
        notify_push: form.notify_push,
        notify_email: form.notify_email,
        days_before: form.days_before,
        updated_at: new Date().toISOString(),
      }

      if (isEdit && reminder) {
        const { error: updateErr } = await supabase
          .from('reminders')
          .update(payload)
          .eq('id', reminder.id)
        if (updateErr) throw new Error(updateErr.message)
      } else {
        const { error: insertErr } = await supabase.from('reminders').insert({
          ...payload,
          user_id: user.id,
          status: 'active',
        })
        if (insertErr) throw new Error(insertErr.message)
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
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] overflow-y-auto">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{isEdit ? t.form_edit_reminder : t.form_add_reminder}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6 mt-3 space-y-4">

          {/* Quick templates — only in add mode */}
          {!isEdit && (
            <div>
              <Label className="text-xs mb-2 block">{t.form_quick_templates}</Label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.title}
                    onClick={() => { set('title', tmpl.title); set('description', tmpl.description) }}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-muted hover:bg-muted/70 whitespace-nowrap"
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fields */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_title}</Label>
            <Input placeholder={t.form_reminder_title_placeholder} value={form.title} onChange={e => set('title', e.target.value)} className="h-10" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_description_label}</Label>
            <Input placeholder={t.form_reminder_desc_placeholder} value={form.description} onChange={e => set('description', e.target.value)} className="h-10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_amount_label}</Label>
              <Input type="number" step="0.01" placeholder="150" value={form.amount} onChange={e => set('amount', e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_due_date}</Label>
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="h-10" />
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label className="text-xs">{t.form_frequency}</Label>
            <div className="grid grid-cols-2 gap-2">
              {FREQ_OPTIONS.map(f => (
                <button
                  key={f.value}
                  onClick={() => set('frequency', f.value)}
                  className={`p-2.5 rounded-xl text-xs border transition-colors text-center ${
                    form.frequency === f.value
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notification method */}
          <div className="space-y-3">
            <Label className="text-xs">{t.notify_days_label}</Label>

            {/* Days before picker */}
            <div className="grid grid-cols-4 gap-1.5">
              {([0, 1, 3, 7] as const).map(d => {
                const labels: Record<number, string> = { 0: t.notify_day_of, 1: t.notify_1_day, 3: t.notify_3_days, 7: t.notify_7_days }
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set('days_before', String(d))}
                    className={`py-2 rounded-xl text-xs border transition-colors ${
                      form.days_before === d
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {labels[d]}
                  </button>
                )
              })}
            </div>

            {/* Toggle pills */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set('notify_push', !form.notify_push)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs border transition-colors ${
                  form.notify_push
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>{form.notify_push ? '✓' : '○'}</span>
                {t.notify_push_label}
              </button>
              <button
                type="button"
                onClick={() => set('notify_email', !form.notify_email)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs border transition-colors ${
                  form.notify_email
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>{form.notify_email ? '✓' : '○'}</span>
                {t.notify_email_label}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t.preview_saving : (isEdit ? t.form_update_reminder : t.form_save_reminder)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
