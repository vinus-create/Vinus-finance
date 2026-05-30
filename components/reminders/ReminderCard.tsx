'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Reminder } from '@/lib/types/app.types'
import { useLang } from '@/lib/i18n/LanguageProvider'
import AddReminderSheet from './AddReminderSheet'

/** Format a Date to YYYY-MM-DD using local timezone (avoids UTC shift for UTC+8) */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Advance a date string by one frequency period */
function advanceDueDate(dateStr: string, freq: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  switch (freq) {
    case 'weekly':  d.setDate(d.getDate() + 7);         break
    case 'monthly': d.setMonth(d.getMonth() + 1);       break
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break
  }
  return toLocalDateStr(d)
}

interface Props {
  reminder: Reminder
}

export default function ReminderCard({ reminder }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const FREQ_LABELS: Record<string, string> = {
    once:    t.freq_once.replace(/^1× /, ''),
    weekly:  t.freq_weekly.replace(/^📅 /, ''),
    monthly: t.freq_monthly.replace(/^🗓️ /, ''),
    yearly:  t.freq_yearly.replace(/^📆 /, ''),
  }

  const dueDate = new Date(reminder.due_date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const isOverdue = diffDays < 0
  const isDueSoon = diffDays >= 0 && diffDays <= 3

  async function markDone() {
    setLoading(true)
    const supabase = createClient()
    if (reminder.frequency === 'once') {
      await supabase.from('reminders').update({ status: 'completed' }).eq('id', reminder.id)
    } else {
      const nextDate = advanceDueDate(reminder.due_date, reminder.frequency)
      await supabase.from('reminders').update({ due_date: nextDate }).eq('id', reminder.id)
    }
    router.refresh()
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', reminder.id)
      if (error) throw new Error(error.message)
      toast.success(reminder.title)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.err_unknown)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card className={cn('border-0 shadow-sm', isOverdue && 'border border-red-200 dark:border-red-900')}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0 mt-0.5">🔔</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm">{reminder.title}</p>
                {reminder.amount != null && (
                  <p className="text-sm font-semibold shrink-0 text-orange-500">
                    RM {Number(reminder.amount).toFixed(2)}
                  </p>
                )}
              </div>
              {reminder.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {reminder.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  isOverdue
                    ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                    : isDueSoon
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {isOverdue
                    ? `${t.reminder_overdue_days} ${Math.abs(diffDays)} ${t.reminder_days}`
                    : diffDays === 0
                    ? t.reminder_today
                    : `${diffDays} ${t.reminder_days_left}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {reminder.due_date} • {FREQ_LABELS[reminder.frequency] ?? reminder.frequency}
                </span>
              </div>
            </div>
          </div>

          {/* Mark done button */}
          <Button
            size="sm"
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-9 text-xs"
            onClick={markDone}
            disabled={loading}
          >
            {loading
              ? '⏳...'
              : reminder.frequency === 'once'
              ? t.reminder_mark_done
              : `${t.reminder_done_next} ${advanceDueDate(reminder.due_date, reminder.frequency)}`}
          </Button>

          {/* Edit + Delete row */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() => setEditOpen(true)}
            >
              ✏️ {t.reminder_edit_btn}
            </Button>
            {confirmDelete ? (
              <Button
                size="sm"
                variant="destructive"
                className="text-xs h-8"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '…' : `⚠️ ${t.confirm}`}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => setConfirmDelete(true)}
              >
                🗑️ {t.delete}
              </Button>
            )}
          </div>

          {/* Delete confirm text */}
          {confirmDelete && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t.reminder_delete_confirm}</span>
              <button
                className="text-muted-foreground underline ml-2"
                onClick={() => setConfirmDelete(false)}
              >
                {t.cancel}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddReminderSheet
        reminder={reminder}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}
