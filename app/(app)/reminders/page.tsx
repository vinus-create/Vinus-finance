import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import ReminderCard from '@/components/reminders/ReminderCard'
import RemindersClient from '@/components/reminders/RemindersClient'
import type { Reminder } from '@/lib/types/app.types'
import EmptyState from '@/components/ui/EmptyState'
import { getServerTranslations } from '@/lib/i18n/server'

export default async function RemindersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t } = await getServerTranslations()

  const { data: reminders } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('due_date', { ascending: true })

  const list = (reminders ?? []) as Reminder[]

  // Split overdue vs upcoming — use MY timezone (UTC+8) to avoid midnight shift
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
  const overdue = list.filter(r => r.due_date < today)
  const upcoming = list.filter(r => r.due_date >= today)

  return (
    <div>
      <PageHeader title={t.reminders_title} showBack />

      <RemindersClient>
        <div className="px-4 mt-4 space-y-4 pb-2">
          {list.length === 0 ? (
            <EmptyState
              emoji="🔔"
              title={t.empty_reminders}
              body={t.empty_reminders_hint}
            />
          ) : (
            <>
              {overdue.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">
                    ⚠️ {t.reminders_overdue} ({overdue.length})
                  </p>
                  <div className="space-y-2">
                    {overdue.map(r => <ReminderCard key={r.id} reminder={r} />)}
                  </div>
                </section>
              )}

              {upcoming.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t.reminders_upcoming} ({upcoming.length})
                  </p>
                  <div className="space-y-2">
                    {upcoming.map(r => <ReminderCard key={r.id} reminder={r} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </RemindersClient>
    </div>
  )
}
