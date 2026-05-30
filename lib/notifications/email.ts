import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface ReminderEmailData {
  to: string
  name: string
  title: string
  description: string | null
  amount: number | null
  currency: string
  due_date: string
  days_before: number
}

function buildEmailHtml(d: ReminderEmailData): string {
  const dueLabel = d.days_before === 0
    ? 'Today'
    : d.days_before === 1
    ? 'Tomorrow'
    : `In ${d.days_before} days (${d.due_date})`

  const amountHtml = d.amount != null
    ? `<p style="font-size:20px;font-weight:700;color:#059669;margin:8px 0 0;">
        ${d.currency} ${Number(d.amount).toFixed(2)}
       </p>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:32px auto;">
    <tr>
      <td style="background:#10b981;border-radius:16px 16px 0 0;padding:24px;text-align:center;">
        <p style="color:#fff;font-size:22px;font-weight:700;margin:0;">🔔 Vinus Finance</p>
        <p style="color:#d1fae5;font-size:13px;margin:4px 0 0;">Bill Reminder</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;border-radius:0 0 16px 16px;padding:24px;border:1px solid #e5e7eb;border-top:0;">
        <p style="font-size:18px;font-weight:600;color:#111;margin:0 0 6px;">${d.title}</p>
        ${d.description ? `<p style="font-size:14px;color:#6b7280;margin:0 0 12px;">${d.description}</p>` : ''}
        ${amountHtml}
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin:16px 0;">
          <p style="font-size:12px;color:#065f46;font-weight:600;margin:0;">📅 Due: ${dueLabel}</p>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/reminders"
           style="display:block;background:#10b981;color:#fff;text-align:center;padding:12px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
          View Reminder →
        </a>
        <p style="font-size:11px;color:#9ca3af;margin-top:16px;text-align:center;">
          Vinus Finance · Malaysian Personal Finance
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendReminderEmail(data: ReminderEmailData): Promise<void> {
  const subject = data.days_before === 0
    ? `🔔 Due Today: ${data.title}`
    : data.days_before === 1
    ? `⏰ Due Tomorrow: ${data.title}`
    : `📅 Upcoming: ${data.title} (in ${data.days_before} days)`

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Vinus Finance <noreply@vinusfinance.com>',
    to: data.to,
    subject,
    html: buildEmailHtml(data),
  })
}
