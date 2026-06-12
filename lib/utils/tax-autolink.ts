import type { SupabaseClient } from '@supabase/supabase-js'
import { RELIEF_MAP } from './tax-calc'
import { EXPENSE_TO_RELIEF } from '@/lib/constants/tax-relief-map'

// ─────────────────────────────────────────────────────────────
// LHDN tax relief auto-linking — deductible expenses are claimed
// against the right relief category the moment they are imported,
// capped at the YA limit, with the transaction IDs linked for audit.
// Ambiguous categories ('suggest' mode) are reported, never claimed.
// ─────────────────────────────────────────────────────────────

export interface TaxLinkTxn {
  id: string
  type: string
  expense_category: string | null
  amount: number
  transaction_date: string
  is_tax_deductible: boolean
}

export interface TaxLinkResult {
  linkedCount: number
  suggestions: Array<{ relief: string; transaction_ids: string[]; total: number }>
}

export async function autoLinkTaxReliefs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  rows: TaxLinkTxn[],
): Promise<TaxLinkResult> {
  const result: TaxLinkResult = { linkedCount: 0, suggestions: [] }

  const deductible = rows.filter(t =>
    t.type === 'expense' && t.is_tax_deductible && t.expense_category &&
    EXPENSE_TO_RELIEF[t.expense_category as keyof typeof EXPENSE_TO_RELIEF]
  )
  if (deductible.length === 0) return result

  // Group by (assessment year, relief category)
  const autoGroups = new Map<string, { year: number; relief: string; ids: string[]; total: number }>()
  const suggestGroups = new Map<string, { relief: string; ids: string[]; total: number }>()

  for (const t of deductible) {
    const mapping = EXPENSE_TO_RELIEF[t.expense_category as keyof typeof EXPENSE_TO_RELIEF]!
    const year = parseInt(t.transaction_date.slice(0, 4), 10)
    if (!year) continue
    if (mapping.mode === 'auto') {
      const key = `${year}|${mapping.relief}`
      const g = autoGroups.get(key) ?? { year, relief: mapping.relief, ids: [], total: 0 }
      g.ids.push(t.id); g.total += t.amount
      autoGroups.set(key, g)
    } else {
      const g = suggestGroups.get(mapping.relief) ?? { relief: mapping.relief, ids: [], total: 0 }
      g.ids.push(t.id); g.total += t.amount
      suggestGroups.set(mapping.relief, g)
    }
  }

  result.suggestions = [...suggestGroups.values()].map(g =>
    ({ relief: g.relief, transaction_ids: g.ids, total: Math.round(g.total * 100) / 100 }))

  if (autoGroups.size === 0) return result

  const { data: profile } = await supabase
    .from('profiles').select('tax_form_type').eq('id', userId).maybeSingle()
  const taxForm = profile?.tax_form_type === 'B' ? 'B' : 'BE'

  for (const g of autoGroups.values()) {
    const cap = RELIEF_MAP[g.relief]?.cap ?? null

    const { data: existing } = await supabase
      .from('tax_reliefs')
      .select('id, claimed_amount, linked_transaction_ids')
      .eq('user_id', userId)
      .eq('assessment_year', g.year)
      .eq('category', g.relief)
      .maybeSingle()

    let reliefId: string | null = null
    if (existing) {
      const linked = new Set<string>(existing.linked_transaction_ids ?? [])
      g.ids.forEach(id => linked.add(id))
      const claimed = Math.round((Number(existing.claimed_amount) + g.total) * 100) / 100
      const { data: upd } = await supabase.from('tax_reliefs').update({
        claimed_amount: cap !== null ? Math.min(cap, claimed) : claimed,
        max_allowed: cap,
        linked_transaction_ids: [...linked],
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id).select('id').single()
      reliefId = upd?.id ?? existing.id
    } else {
      const { data: ins } = await supabase.from('tax_reliefs').insert({
        user_id: userId,
        assessment_year: g.year,
        tax_form: taxForm,
        category: g.relief,
        claimed_amount: cap !== null ? Math.min(cap, g.total) : g.total,
        max_allowed: cap,
        description: 'Auto-linked from imported transactions',
        linked_transaction_ids: g.ids,
      }).select('id').single()
      reliefId = ins?.id ?? null
    }

    if (reliefId) {
      await supabase.from('transactions')
        .update({ tax_relief_id: reliefId })
        .in('id', g.ids)
      result.linkedCount += g.ids.length
    }
  }

  return result
}
