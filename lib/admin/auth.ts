import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'admin_session'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function secret(): string {
  const s = process.env.ADMIN_SECRET
  if (!s) throw new Error('ADMIN_SECRET is not set')
  return s
}

export function createAdminToken(): string {
  const ts = Date.now().toString()
  const sig = createHmac('sha256', secret()).update(`admin:${ts}`).digest('hex')
  return `${ts}.${sig}`
}

export function verifyAdminToken(token: string): boolean {
  try {
    const [ts, sig] = token.split('.')
    if (!ts || !sig) return false
    if (Date.now() - parseInt(ts) > TTL_MS) return false
    const expected = createHmac('sha256', secret()).update(`admin:${ts}`).digest('hex')
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  return verifyAdminToken(token)
}

export { COOKIE_NAME as ADMIN_COOKIE_NAME }
