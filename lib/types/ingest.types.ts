import type { ParsedTransaction } from '@/lib/ai/parser'

// ─── Shared ingest pipeline types (API ↔ UI) ─────────────────

export interface CandidateAccount {
  suggested_name: string
  institution: string
  last4: string
  account_type: 'bank' | 'ewallet' | 'credit_card'
  closing_balance: number | null
  statement_date: string | null
}

/** Extra parse metadata returned by POST /api/ingest for statement uploads */
export interface IngestMeta {
  batchId: string | null
  duplicates: ParsedTransaction[]   // certain duplicates — auto-skipped
  suspected: ParsedTransaction[]    // fuzzy duplicates — user-overridable
  candidateAccount: CandidateAccount | null
}

/** One row in the POST /api/ingest/save payload */
export interface SaveTransactionRow extends ParsedTransaction {
  is_duplicate_override?: boolean
}

export interface IngestSaveRequest {
  batchId: string | null
  transactions: SaveTransactionRow[]
  /** Confirmed account auto-discovery — create this account before inserting */
  createAccount: CandidateAccount | null
  /** Sync the statement's closing balance onto this account AFTER insert */
  statementSync: {
    account_name: string
    closing_balance: number | null
    statement_date: string | null
  } | null
}
