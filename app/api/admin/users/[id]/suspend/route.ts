import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken, ADMIN_COOKIE_NAME } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { suspend } = await req.json()
  const supabase = createAdminClient()

  await supabase
    .from('profiles')
    .update({ is_suspended: suspend })
    .eq('id', id)

  // Also update Supabase Auth ban status
  try {
    await supabase.auth.admin.updateUserById(id, {
      ban_duration: suspend ? '876600h' : 'none',
    })
  } catch {
    // Non-fatal — profile flag is the primary gate
  }

  return NextResponse.json({ ok: true })
}
