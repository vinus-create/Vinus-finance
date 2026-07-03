import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken, ADMIN_COOKIE_NAME } from '@/lib/admin/auth'
import { setAppConfig } from '@/lib/admin/config'
import { ALLOWED_MODEL_IDS } from '@/lib/constants/ai-models'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { standard, hq } = await req.json()

  if (!ALLOWED_MODEL_IDS.includes(standard) || !ALLOWED_MODEL_IDS.includes(hq)) {
    return NextResponse.json({ error: 'Invalid model' }, { status: 400 })
  }

  await Promise.all([
    setAppConfig('ai_model_standard', standard),
    setAppConfig('ai_model_hq', hq),
  ])

  return NextResponse.json({ ok: true })
}
