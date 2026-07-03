import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPENSE_CATEGORIES } from '@/lib/constants/categories'
import type { ParsedTransaction } from '@/lib/ai/parser'
import type { ExpenseCategory } from '@/lib/types/app.types'

// ─── Merchant → category memory ───────────────────────────────
// Two write paths into merchant_categories:
//   source='user'  — the user manually picked a category (EditTransactionSheet). Always wins.
//   source='ai'    — Gemini world-knowledge guess. Never overwrites an existing row.
// Lookup happens at import: rows that parsed as other/null get patched from
// memory first, then one batched Gemini call for merchants never seen before.
// ponytail: Gemini IS the "search online" — it knows Pinduoduo/Sin Nam Huat.
// Upgrade path: grounded search API if Gemini misses too many local shops.

const VALID_IDS = new Set(EXPENSE_CATEGORIES.map(c => c.value))

function merchantKey(name: string): string {
  return name.trim().toLowerCase()
}

function needsCategory(t: ParsedTransaction): boolean {
  return t.type === 'expense'
    && !!t.merchant_name
    && (!t.expense_category || t.expense_category === 'other_expense')
}

/** Patch other/null expense categories from memory, then Gemini for unknowns. Never throws. */
export async function enrichCategories(
  supabase: SupabaseClient,
  userId: string,
  rows: ParsedTransaction[],
): Promise<void> {
  try {
    const targets = rows.filter(needsCategory)
    if (targets.length === 0) return
    const keys = [...new Set(targets.map(t => merchantKey(t.merchant_name!)))]

    // 1. Memory lookup
    const { data: known } = await supabase
      .from('merchant_categories')
      .select('merchant_key, category')
      .eq('user_id', userId)
      .in('merchant_key', keys)

    const memory = new Map<string, string>()
    for (const r of known ?? []) {
      if (VALID_IDS.has(r.category as ExpenseCategory)) memory.set(r.merchant_key, r.category)
    }

    // 2. Gemini for merchants memory doesn't know
    const unknown = keys.filter(k => !memory.has(k))
    if (unknown.length > 0) {
      const guessed = await aiGuessCategories(unknown)
      const inserts: Array<{ user_id: string; merchant_key: string; category: string; source: string }> = []
      for (const [k, cat] of guessed) {
        memory.set(k, cat)
        inserts.push({ user_id: userId, merchant_key: k, category: cat, source: 'ai' })
      }
      if (inserts.length > 0) {
        // ignoreDuplicates → AI never overwrites a user-confirmed mapping
        await supabase.from('merchant_categories').upsert(inserts, { ignoreDuplicates: true })
      }
    }

    // 3. Apply
    for (const t of targets) {
      const cat = memory.get(merchantKey(t.merchant_name!))
      if (cat) t.expense_category = cat as ExpenseCategory
    }
  } catch (err) {
    console.error('[merchant-memory] enrich failed (non-fatal):', err)
  }
}

/** One batched Gemini call: merchant names → category ids. Unknowns are omitted. */
async function aiGuessCategories(merchants: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const { getFlashModel } = await import('@/lib/ai/gemini')
    const model = await getFlashModel()
    const catList = EXPENSE_CATEGORIES.map(c => `${c.value} (${c.label})`).join(', ')
    const prompt = `You are categorizing Malaysian expense merchants. For each merchant below, use your knowledge of what the business does (e.g. "Pinduoduo" is a Chinese online shopping platform, "Sin Nam Huat" is a Malaysian chicken rice restaurant chain) and pick the best category id from this list:
${catList}

Merchants: ${JSON.stringify(merchants)}

Reply with ONLY a JSON object mapping each merchant to a category id. If you genuinely cannot tell what a merchant is, omit it. Example: {"pinduoduo": "shopee", "sin nam huat": "restaurant"}`

    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text()) as Record<string, string>
    for (const [k, v] of Object.entries(parsed)) {
      if (VALID_IDS.has(v as ExpenseCategory) && v !== 'other_expense') out.set(merchantKey(k), v)
    }
  } catch (err) {
    console.error('[merchant-memory] AI guess failed (non-fatal):', err)
  }
  return out
}

/** Remember a user's manual category choice. Always overwrites. Fire-and-forget safe. */
export async function rememberUserChoice(
  supabase: SupabaseClient,
  userId: string,
  merchantName: string,
  category: string,
): Promise<void> {
  if (!merchantName.trim() || !VALID_IDS.has(category as ExpenseCategory) || category === 'other_expense') return
  await supabase.from('merchant_categories').upsert({
    user_id: userId,
    merchant_key: merchantKey(merchantName),
    category,
    source: 'user',
    updated_at: new Date().toISOString(),
  })
}
