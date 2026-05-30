import webpush from 'web-push'

export interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

function initVapid() {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? 'admin@vinusfinance.com'}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

/**
 * Send a web push notification to one subscription.
 * Returns true on success, false on gone (410/404 — subscription expired).
 */
export async function sendPushNotification(
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<boolean> {
  initVapid()
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
    return true
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 410 || status === 404) return false   // subscription expired
    throw err
  }
}

/** Send to all subscriptions for a user, cleaning up expired ones. */
export async function sendPushToSubscriptions(
  subs: PushSubscriptionRow[],
  payload: PushPayload,
  onExpired?: (endpoint: string) => void,
) {
  await Promise.allSettled(
    subs.map(async sub => {
      const ok = await sendPushNotification(sub, payload)
      if (!ok) onExpired?.(sub.endpoint)
    })
  )
}
