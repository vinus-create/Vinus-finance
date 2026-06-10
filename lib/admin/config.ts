import { createAdminClient } from '@/lib/supabase/admin'

// In-memory cache with 60s TTL (per serverless instance)
const cache = new Map<string, { value: string; expiresAt: number }>()

const DEFAULTS: Record<string, string> = {
  ai_model_standard: 'gemini-2.5-flash-lite',
  ai_model_hq: 'gemini-2.5-flash',
}

export async function getAppConfig(key: string): Promise<string> {
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.value

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single()
    const value = data?.value ?? DEFAULTS[key] ?? ''
    cache.set(key, { value, expiresAt: Date.now() + 60_000 })
    return value
  } catch {
    return DEFAULTS[key] ?? ''
  }
}

export async function setAppConfig(key: string, value: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('app_config')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  // Invalidate cache immediately
  cache.delete(key)
}

export async function getAllAppConfigs(): Promise<Record<string, string>> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('app_config').select('key, value')
    const result: Record<string, string> = { ...DEFAULTS }
    for (const row of data ?? []) result[row.key] = row.value
    return result
  } catch {
    return { ...DEFAULTS }
  }
}
