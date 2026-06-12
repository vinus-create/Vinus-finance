import type { ExpenseCategory } from '@/lib/types/app.types'

// ─────────────────────────────────────────────────────────────
// Expense category → LHDN tax relief category mapping (YA2025).
// Caps live in lib/utils/tax-calc.ts RELIEF_META — single source.
//
// mode 'auto'    → claim immediately on import (capped, linked)
// mode 'suggest' → ambiguous: surface as a suggestion, never auto-claim
//   (e.g. an "insurance" payment could be life / medical / car insurance —
//    only the first two are reliefs, under different categories)
// ─────────────────────────────────────────────────────────────

export interface ReliefMapping {
  relief: string                 // tax_relief_category enum value
  mode: 'auto' | 'suggest'
}

export const EXPENSE_TO_RELIEF: Partial<Record<ExpenseCategory, ReliefMapping>> = {
  // Lifestyle (RM2,500): books, internet, PC/phone, courses
  books:          { relief: 'lifestyle',            mode: 'auto' },
  // Additional sports lifestyle (RM1,000): gym fees, sports equipment
  gym:            { relief: 'lifestyle_additional', mode: 'auto' },
  // Self education (RM7,000): course/tuition fees
  education:      { relief: 'self_education',       mode: 'auto' },
  // EPF contributions count toward the combined life-insurance+EPF RM7,000
  epf_kwsp:       { relief: 'life_insurance_epf',   mode: 'auto' },
  // SOCSO/PERKESO contributions (RM350)
  socso_perkeso:  { relief: 'socso_voluntary',      mode: 'auto' },

  // Ambiguous — suggest only:
  medical:        { relief: 'serious_illness',      mode: 'suggest' }, // self RM10k bucket needs serious illness/dental/checkup proof
  pharmacy:       { relief: 'serious_illness',      mode: 'suggest' },
  insurance:      { relief: 'medical_insurance',    mode: 'suggest' }, // life vs medical vs car — user must confirm
  internet_telco: { relief: 'lifestyle',            mode: 'suggest' }, // internet bill qualifies, phone bill doesn't
  electronics:    { relief: 'lifestyle',            mode: 'suggest' }, // PC/smartphone qualify, others don't
}
