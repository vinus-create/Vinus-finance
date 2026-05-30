// GET /api/cron/reminders
// Called daily at 8:00 AM (configured via vercel.json or external cron)
// Sends push notifications and emails for due reminders.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToSubscriptions } from '@/lib/notifications/push'
import { sendReminderEmail } from '@/lib/notifications/email'

export const runtime = 'nodejs'

function localDateStr(date: Date): string {
  // Returns YYYY-MM-DD in local server time — match what's stored in DB
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch all active reminders with notifications enabled
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('status', 'active')
    .or('notify_push.eq.true,notify_email.eq.true')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active reminders with notifications' })
  }

  let pushed = 0
  let emailed = 0
  const errors: string[] = []

  for (const reminder of reminders) {
    const dueDate = new Date(reminder.due_date + 'T00:00:00')
    const notifyDate = addDays(dueDate, -(reminder.days_before ?? 1))
    const notifyDateStr = localDateStr(notifyDate)
    const todayStr = localDateStr(today)

    if (notifyDateStr !== todayStr) continue  // not today

    const daysBeforeLabel = reminder.days_before === 0
      ? 'due today'
      : reminder.days_before === 1
      ? 'due tomorrow'
      : `due in ${reminder.days_before} days`

    const pushTitle = `🔔 ${reminder.title}`
    const pushBody = reminder.amount
      ? `MYR ${Number(reminder.amount).toFixed(2)} — ${daysBeforeLabel}`
      : daysBeforeLabel

    // ── Push notification ──────────────────────────────────────
    if (reminder.notify_push) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', reminder.user_id)

      if (subs && subs.length > 0) {
        try {
          await sendPushToSubscriptions(subs, {
            title: pushTitle,
            body: pushBody,
            url: '/reminders',
            tag: reminder.id,
          }, async (expiredEndpoint) => {
            // Clean up expired subscriptions
            await supabase.from('push_subscriptions').delete().eq('endpoint', expiredEndpoint)
          })
          pushed++
        } catch (err) {
          errors.push(`push[${reminder.id}]: ${err}`)
        }
      }
    }

    // ── Email ──────────────────────────────────────────────────
    if (reminder.notify_email) {
      // Get user's email via admin client (requires service role key)
      const admin = createAdminClient()
      const { data: { user } } = await admin.auth.admin.getUserById(reminder.user_id)
      if (user?.email) {
        try {
          await sendReminderEmail({
            to: user.email,
            name: user.email.split('@')[0],
            title: reminder.title,
            description: reminder.description,
            amount: reminder.amount,
            currency: reminder.currency ?? 'MYR',
            due_date: reminder.due_date,
            days_before: reminder.days_before ?? 1,
          })
          emailed++
        } catch (err) {
          errors.push(`email[${reminder.id}]: ${err}`)
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    pushed,
    emailed,
    errors: errors.length > 0 ? errors : undefined,
    checkedAt: new Date().toISOString(),
  })
}
