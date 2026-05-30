import { createClient } from '@supabase/supabase-js'

// Server-side admin client using service role key.
// Only use in trusted server contexts (API routes, cron jobs).
// NEVER expose service_role key to the client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in .env.local')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
