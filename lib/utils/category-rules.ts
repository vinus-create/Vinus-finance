import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedTransaction } from '@/lib/ai/parser'
import type { ExpenseCategory } from '@/lib/types/app.types'

// User-defined categorization rules: a substring pattern → category.
// e.g. pattern "GWP00" → shopee. Runs BEFORE merchant-memory/AI during import,
// so an explicit rule always wins. Highest priority first; first hit applies.
// Never throws — a missing table just means "no rules yet".
export async function applyCategoryRules(
  supabase: SupabaseClient,
  userId: string,
  rows: ParsedTransaction[],
): Promise<void> {
  try {
    const { data: rules, error } = await supabase
      .from('category_rules')
      .select('pattern, category, match_field, priority')
      .eq('user_id', userId)
      .order('priority', { ascending: false })
    if (error || !rules || rules.length === 0) return

    for (const t of rows) {
      if (t.type !== 'expense') continue
      const merchant = (t.merchant_name ?? '').toLowerCase()
      const desc = (t.description ?? '').toLowerCase()
      for (const r of rules) {
        const p = String(r.pattern).toLowerCase().trim()
        if (!p) continue
        const field = r.match_field ?? 'any'
        const hit =
          (field === 'merchant' && merchant.includes(p)) ||
          (field === 'description' && desc.includes(p)) ||
          (field === 'any' && (merchant.includes(p) || desc.includes(p)))
        if (hit) {
          // DB column is text (custom categories allowed), so any slug is valid.
          t.expense_category = r.category as ExpenseCategory
          break
        }
      }
    }
  } catch (err) {
    console.error('[category-rules] apply failed (non-fatal):', err)
  }
}
