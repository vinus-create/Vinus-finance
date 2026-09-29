import type { ParsedTransaction } from '@/lib/ai/parser'

// ─────────────────────────────────────────────────────────────
// Transfer pair-matching — collapses the two legs of one money
// movement (e.g. Maybank debit "TNG RELOAD" + TNG statement credit
// "Reload") into a single `transfer` row, so own-account movements
// never inflate income/expense totals.
// ─────────────────────────────────────────────────────────────

const MAX_DAY_DELTA = 2

// Only rows that *look* like transfers are eligible for merging —
// prevents a RM50 mamak expense pairing with an unrelated RM50 credit.
const TRANSFERISH = /transfer|trf\b|duitnow|ibg|instant|ibft|top.?up|topup|reload|own acc|pemindahan|pindah|m2u|sendiri/i

const CARDISH = /card|kad|kredit|credit|cc|jompay/i

const TRANSFERISH_EXPENSE_CATS = new Set(['other_expense', 'touch_n_go', 'savings', 'investment'])
const TRANSFERISH_INCOME_CATS = new Set(['other_income', 'interest'])

function text(t: ParsedTransaction): string {
  return `${t.description ?? ''} ${t.merchant_name ?? ''}`
}

function isTransferishExpense(t: ParsedTransaction): boolean {
  return t.type === 'expense' && (
    TRANSFERISH.test(text(t)) ||
    (t.expense_category !== null && TRANSFERISH_EXPENSE_CATS.has(t.expense_category))
  )
}

function isTransferishIncome(t: ParsedTransaction): boolean {
  return t.type === 'income' && (
    TRANSFERISH.test(text(t)) ||
    (t.income_category !== null && TRANSFERISH_INCOME_CATS.has(t.income_category))
  )
}

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '')
}

function dayDelta(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return ms / 86_400_000
}

function sameAmount(a: number, b: number): boolean {
  return a.toFixed(2) === b.toFixed(2)
}

/** Two transfer rows describing the same movement (seen from both statements)? */
function transfersOverlap(a: ParsedTransaction, b: ParsedTransaction): boolean {
  if (!sameAmount(a.amount, b.amount) || dayDelta(a.transaction_date, b.transaction_date) > MAX_DAY_DELTA) return false
  const aFrom = norm(a.account_name), aTo = norm(a.to_account_name)
  const bFrom = norm(b.account_name), bTo = norm(b.to_account_name)
  const overlap = (x: string, y: string) =>
    x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))
  return overlap(aFrom, bFrom) || (aTo !== '' && bTo !== '' && overlap(aTo, bTo))
    || (aTo !== '' && overlap(aTo, bFrom)) || (bTo !== '' && overlap(bTo, aFrom))
}

// ─── Which leg of a statement transfer is the statement account? ──────
/**
 * A credit on a statement that the AI marked as a transfer (e.g. a card
 * "PAYMENT REC'D WITH THANKS") moves money INTO the statement account. Pin
 * to_account_name to its exact name; keep the source only when it names one of
 * the user's accounts exactly, else "" (unknown — user can pick it in preview,
 * or importing the paying bank's statement later fills it in).
 *
 * On a CARD statement the AI often writes the card on both legs ("UOB → UOB");
 * card statements have no outgoing transfers, so that is a payment received.
 * Bank-side card payments get their destination resolved to the user's real
 * card account so no junk "UOB" account is auto-created.
 */
export function normalizeStatementTransfers(
  rows: ParsedTransaction[],
  opts: {
    stmtAccount: string
    stmtIsCard: boolean
    accountNames: string[]
    resolveCard: (name: string) => string | null
  },
): void {
  const overlaps = (x: string, y: string) => x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))
  const stmtN = norm(opts.stmtAccount)
  for (const t of rows) {
    if (t.type !== 'transfer') continue
    const from = (t.account_name ?? '').trim()
    const fromIsStmt = from !== '' && overlaps(norm(from), stmtN)
    const toIsStmt = from === '' || overlaps(norm(t.to_account_name), stmtN)
    const incoming = (toIsStmt && !fromIsStmt) || (fromIsStmt && toIsStmt && opts.stmtIsCard)
    if (incoming) {
      t.to_account_name = opts.stmtAccount
      t.account_name = fromIsStmt ? '' : (opts.accountNames.find(n => norm(n) === norm(from)) ?? '')
    } else if (t.to_account_name && CARDISH.test(`${text(t)} ${t.to_account_name}`)) {
      const card = opts.resolveCard(t.to_account_name)
      if (card) t.to_account_name = card
    }
  }
}

export interface BatchMatchResult {
  rows: ParsedTransaction[]
  mergedCount: number
}

/**
 * In-batch matching, run after parsing (before preview):
 * 1. Collapse duplicate transfer rows (both statements reported the same reload)
 * 2. Merge transferish expense+income pairs into a single transfer row
 */
export function matchTransfersInBatch(input: ParsedTransaction[]): BatchMatchResult {
  const rows = [...input]
  let merged = 0

  // 1. transfer-vs-transfer collapse
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].type !== 'transfer') continue
    for (let j = rows.length - 1; j > i; j--) {
      if (rows[j].type !== 'transfer') continue
      if (transfersOverlap(rows[i], rows[j])) {
        // keep the leg with more complete from/to information
        const score = (r: ParsedTransaction) => (r.account_name?.trim() ? 1 : 0) + (r.to_account_name ? 1 : 0)
        const keepJ = score(rows[j]) > score(rows[i])
        if (keepJ) rows[i] = rows[j]
        rows.splice(j, 1)
        merged++
      }
    }
  }

  // 2. expense + income → transfer
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i]
    if (!isTransferishExpense(e)) continue
    const jIdx = rows.findIndex((c, j) =>
      j !== i &&
      isTransferishIncome(c) &&
      sameAmount(c.amount, e.amount) &&
      dayDelta(c.transaction_date, e.transaction_date) <= MAX_DAY_DELTA &&
      norm(c.account_name) !== norm(e.account_name)
    )
    if (jIdx === -1) continue
    const inc = rows[jIdx]
    rows[i] = {
      ...e,
      type: 'transfer',
      expense_category: null,
      income_category: null,
      to_account_name: inc.account_name,
      description: e.description || `${e.account_name} → ${inc.account_name}`,
      is_tax_deductible: false,
      confidence: Math.min(e.confidence, inc.confidence),
    }
    rows.splice(jIdx, 1)
    merged++
    if (jIdx < i) i-- // account for removal before cursor
  }

  return { rows, mergedCount: merged }
}

// ─── Cross-import matching (against rows already in the DB) ───

export interface DbTxnLite {
  id: string
  type: string
  amount: number
  account_name: string
  to_account_name: string | null
  transaction_date: string
  description: string | null
  merchant_name: string | null
  expense_category: string | null
  income_category: string | null
}

export interface DbMatchResult {
  /** incoming rows that should still be inserted */
  rows: ParsedTransaction[]
  /** existing DB rows to convert into transfers (their categories nulled) */
  conversions: Array<{ id: string; account_name: string; to_account_name: string }>
  /** incoming rows dropped because the movement already exists as a transfer */
  droppedCount: number
}

/**
 * Save-time matching: an incoming statement leg may pair with a row imported
 * weeks earlier from the other account's statement. The existing DB row is
 * converted to a transfer (balance corrected by the trigger) and the incoming
 * leg is dropped — one movement, one row.
 */
export function matchTransfersAgainstDb(
  incoming: ParsedTransaction[],
  dbRecent: DbTxnLite[],
): DbMatchResult {
  const rows: ParsedTransaction[] = []
  const conversions: DbMatchResult['conversions'] = []
  const consumed = new Set<string>()
  let droppedCount = 0

  const dbLiteToParsed = (d: DbTxnLite): ParsedTransaction => ({
    type: d.type as ParsedTransaction['type'],
    amount: d.amount,
    currency: 'MYR',
    expense_category: d.expense_category as ParsedTransaction['expense_category'],
    income_category: d.income_category as ParsedTransaction['income_category'],
    description: d.description ?? '',
    merchant_name: d.merchant_name,
    reference_number: null,
    transaction_date: d.transaction_date,
    account_name: d.account_name,
    to_account_name: d.to_account_name,
    ledger: 'personal',
    is_tax_deductible: false,
    confidence: 1,
  })

  for (const t of incoming) {
    // Incoming transfer already recorded (the other statement got there first)?
    if (t.type === 'transfer') {
      const dup = dbRecent.find(d =>
        !consumed.has(d.id) && d.type === 'transfer' && transfersOverlap(t, dbLiteToParsed(d))
      )
      if (dup) {
        consumed.add(dup.id)
        // The recorded leg came from a card statement that couldn't name the
        // paying bank (source "") — this leg knows it, so fill it in.
        if (!(dup.account_name ?? '').trim() && t.account_name?.trim()) {
          conversions.push({ id: dup.id, account_name: t.account_name, to_account_name: dup.to_account_name ?? t.to_account_name ?? '' })
        }
        droppedCount++
        continue
      }
      rows.push(t)
      continue
    }

    // Bank-side card payment the AI booked as an expense ↔ an existing card-side
    // transfer with unknown source: same movement — fill the source, drop this.
    if (t.type === 'expense' && CARDISH.test(text(t))) {
      const open = dbRecent.find(d =>
        !consumed.has(d.id) && d.type === 'transfer' && !(d.account_name ?? '').trim() &&
        sameAmount(d.amount, t.amount) && dayDelta(d.transaction_date, t.transaction_date) <= MAX_DAY_DELTA
      )
      if (open) {
        consumed.add(open.id)
        conversions.push({ id: open.id, account_name: t.account_name, to_account_name: open.to_account_name ?? '' })
        droppedCount++
        continue
      }
    }

    // Incoming expense ↔ existing income (or vice versa) = one movement
    if (isTransferishExpense(t)) {
      const match = dbRecent.find(d =>
        !consumed.has(d.id) && d.type === 'income' &&
        isTransferishIncome(dbLiteToParsed(d)) &&
        sameAmount(d.amount, t.amount) &&
        dayDelta(d.transaction_date, t.transaction_date) <= MAX_DAY_DELTA &&
        norm(d.account_name) !== norm(t.account_name)
      )
      if (match) {
        consumed.add(match.id)
        conversions.push({ id: match.id, account_name: t.account_name, to_account_name: match.account_name })
        droppedCount++
        continue
      }
    } else if (isTransferishIncome(t)) {
      const match = dbRecent.find(d =>
        !consumed.has(d.id) && d.type === 'expense' &&
        isTransferishExpense(dbLiteToParsed(d)) &&
        sameAmount(d.amount, t.amount) &&
        dayDelta(d.transaction_date, t.transaction_date) <= MAX_DAY_DELTA &&
        norm(d.account_name) !== norm(t.account_name)
      )
      if (match) {
        consumed.add(match.id)
        conversions.push({ id: match.id, account_name: match.account_name, to_account_name: t.account_name })
        droppedCount++
        continue
      }
    }

    rows.push(t)
  }

  return { rows, conversions, droppedCount }
}
