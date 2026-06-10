import { NextRequest, NextResponse } from 'next/server'
import { createAdminToken, ADMIN_COOKIE_NAME } from '@/lib/admin/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const expectedUser = process.env.ADMIN_USERNAME ?? 'ADMIN'
  const expectedPass = process.env.ADMIN_PASSWORD

  if (
    username?.trim().toUpperCase() !== expectedUser.toUpperCase() ||
    password !== expectedPass
  ) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = createAdminToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  })
  return res
}
