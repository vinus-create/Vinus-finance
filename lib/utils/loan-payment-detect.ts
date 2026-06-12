import type { SupabaseClient } from '@supabase/supabase-js'
import { calcPaymentSplit, advanceMonths } from './loan-math'

// ─────────────────────────────────────────────────────────────
// Loan payment auto-detection — when an imported bank-statement row
// is a loan installment, split it into principal + interest, persist
// the amortization row and decrement the loan's outstanding balance,
// so net worth tracks reality without any manual entry.
// ─────────────────────────────────────────────────────────────

const AMOUNT_TOLERANCE = 0.05 // ±5% of monthly_payment

export interface InsertedTxnLite {
  id: string
  type: string
  expense_category: string | null
  amount: number
  transaction_date: string
  description: string | null
  merchant_name: string | null
}

interface LoanLite {
  id: string
  name: string
  lender_name: string | null
  outstanding_balance: number
  principal_amount: number
  interest_rate: number
  monthly_payment: number
  tenure_months: number
  remaining_months: number | null
  next_payment_date: string | null
  start_date: string
  interest_method: string
}

function matchesLoan(t: InsertedTxnLite, loan: LoanLite): boolean {
  const withinTolerance =
    Math.abs(t.amount - loan.monthly_payment) / loan.monthly_payment <= AMOUNT_TOLERANCE
  if (withinTolerance) return true
  // fallback: row explicitly names the loan / lender
  const hay = `${t.description ?? ''} ${t.merchant_name ?? ''}`.toLowerCase()
  const names = [loan.name, loan.lender_name ?? ''].map(s => s.toLowerCase()).filter(s => s.length >= 4)
  return names.some(n => hay.includes(n)) && t.amount <= loan.outstanding_balance + loan.monthly_payment
}

/**
 * Detects loan installments among freshly inserted transactions and records
 * them in loan_payments (principal/interest split) + updates the loan.
 * Idempotent: loan_payments.transaction_id is UNIQUE — a re-processed
 * transaction is skipped, so re-imports never double-decrement a loan.
 */
export async function detectAndRecordLoanPayments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  inserted: InsertedTxnLite[],
): Promise<number> {
  const candidates = inserted.filter(t => t.type === 'expense' && t.expense_category === 'loan_repayment')
  if (candidates.length === 0) return 0

  const { data: loanRows } = await supabase
    .from('loans')
    .select('id, name, lender_name, outstanding_balance, principal_amount, interest_rate, monthly_payment, tenure_months, remaining_months, next_payment_date, start_date, interest_method')
    .eq('user_id', userId)
    .eq('is_active', true)
  const loans = (loanRows ?? []) as LoanLite[]
  if (loans.length === 0) return 0

  let recorded = 0
  for (const t of candidates) {
    // Prefer the loan whose installment is closest to the row amount
    const loan = loans
      .filter(l => matchesLoan(t, l))
      .sort((a, b) => Math.abs(t.amount - a.monthly_payment) - Math.abs(t.amount - b.monthly_payment))[0]
    if (!loan) continue

    const split = calcPaymentSplit(
      loan.outstanding_balance, loan.principal_amount, loan.interest_rate,
      t.amount, loan.tenure_months, loan.interest_method,
    )
    const balanceAfter = Math.max(0, loan.outstanding_balance - split.principal)

    // UNIQUE(transaction_id) makes this idempotent across re-imports
    const { error: payErr } = await supabase.from('loan_payments').insert({
      user_id: userId,
      loan_id: loan.id,
      transaction_id: t.id,
      payment_date: t.transaction_date,
      amount: t.amount,
      principal_component: split.principal,
      interest_component: split.interest,
      balance_after: balanceAfter,
      is_extra_payment: Math.abs(t.amount - loan.monthly_payment) / loan.monthly_payment > AMOUNT_TOLERANCE,
    })
    if (payErr) continue // duplicate transaction_id or other constraint — skip silently

    await supabase.from('loans').update({
      outstanding_balance: balanceAfter,
      remaining_months: Math.max(0, (loan.remaining_months ?? loan.tenure_months) - 1),
      next_payment_date: advanceMonths(loan.next_payment_date ?? loan.start_date, 1),
      is_active: balanceAfter > 0,
      updated_at: new Date().toISOString(),
    }).eq('id', loan.id)

    // keep the in-memory copy current in case one import has several installments
    loan.outstanding_balance = balanceAfter
    loan.remaining_months = Math.max(0, (loan.remaining_months ?? loan.tenure_months) - 1)
    loan.next_payment_date = advanceMonths(loan.next_payment_date ?? loan.start_date, 1)
    recorded++
  }
  return recorded
}
