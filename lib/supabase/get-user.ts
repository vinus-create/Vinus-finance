import { cache } from 'react'
import { createClient } from './server'

/**
 * Cached getUser() — deduplicates the auth call within a single request.
 * Both layout.tsx and page.tsx can call this; Supabase is only hit once.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
