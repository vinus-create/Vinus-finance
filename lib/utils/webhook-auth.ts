import { createHmac, timingSafeEqual } from 'node:crypto'

// Webhook authenticity checks. Both webhook routes are public (Telegram/Meta must
// reach them) and write transactions with the service-role client, so without
// these anyone could POST a forged message and book fake transactions into any
// linked user's account.

/** Constant-time string comparison (no early exit that leaks the secret). */
export function safeEqual(a: string | null | undefined, b: string): boolean {
  if (!a) return false
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Meta (WhatsApp) signs the raw body: header `X-Hub-Signature-256: sha256=<hex hmac>`. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  return safeEqual(header, expected)
}
