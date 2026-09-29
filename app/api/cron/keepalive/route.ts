// GET /api/cron/keepalive
// Daily no-op query so the free-tier Supabase project never hits the ~7-day
// idle timer and auto-pauses (which takes DNS down and breaks every login).
// Uses the service-role client on purpose: the cookie-based client has no
// session in a cron request, so RLS would block the read and no real query
// would reach Postgres — i.e. it would not count as activity.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
