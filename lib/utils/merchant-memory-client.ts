import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPENSE_CATEGORIES } from '@/lib/constants/categories'

// Client-safe half of merchant memory.
// Lives in its own module because merchant-memory.ts reaches gemini.ts, which
// imports `after` from next/server (server-only). EditTransactionSheet is a
// client component, so importing the server half from it breaks the build.

const BUILTIN_IDS = new Set(EXPENSE_CATEGORIES.map(c => c.value as string))

/** A built-in expense slug, or one of the user's custom categories. */
export function isValidCategorySlug(slug: string): boolean {
  return BUILTIN_IDS.has(slug) || slug.startsWith('custom_')
}

export function merchantKey(name: string): string {
  return name.trim().toLowerCase()
}

/** Remember a user's manual category choice. Always overwrites the AI guess. */
export async function rememberUserChoice(
  supabase: SupabaseClient,
  userId: string,
  merchantName: string,
  category: string,
): Promise<void> {
  if (!merchantName.trim() || !isValidCategorySlug(category) || category === 'other_expense') return
  await supabase.from('merchant_categories').upsert({
    user_id: userId,
    merchant_key: merchantKey(merchantName),
    category,
    source: 'user',
    updated_at: new Date().toISOString(),
  })
}
