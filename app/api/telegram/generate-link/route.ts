import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/telegram/generate-link
// Generates a one-time token for auto-linking Telegram account
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete any existing tokens for this user
  await supabase.from('telegram_link_tokens').delete().eq('user_id', user.id)

  // Create new token (expires in 15 minutes)
  const { data, error } = await supabase
    .from('telegram_link_tokens')
    .insert({ user_id: user.id })
    .select('token')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create token' }, { status: 500 })
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'VinusFinanceBot'
  const deepLink = `https://t.me/${botUsername}?start=${data.token}`

  return NextResponse.json({ token: data.token, deepLink })
}
