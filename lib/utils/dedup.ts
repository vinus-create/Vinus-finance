import { createHash } from 'crypto'

// ─────────────────────────────────────────────────────────────
// Transaction fingerprint — TypeScript twin of the SQL function
// public.fn_txn_dedup_hash (supabase/migrations/001_automation_foundation.sql).
//
// ⚠️ INVARIANT: this recipe MUST stay byte-identical to the SQL version.
// Recipe: md5( user_id | lower(account) | YYYY-MM-DD | type | amount(2dp) |
//              trimmed-ref OR whitespace-collapsed lowercase description )
//
// Fixture vector (same in SQL):
//   computeDedupHash('00000000-0000-0000-0000-000000000001', 'Maybank',
//     '2026-03-16', 'expense', 29, null, '  Chicken  Rice ')
//   === md5('00000000-0000-0000-0000-000000000001|maybank|2026-03-16|expense|29.00| chicken rice ')
// ─────────────────────────────────────────────────────────────

export function computeDedupHash(
  userId: string,
  accountName: string | null,
  transactionDate: string,   // YYYY-MM-DD
  type: string,              // income | expense | transfer
  amount: number,
  referenceNumber: string | null,
  description: string | null,
): string {
  const ref = (referenceNumber ?? '').trim()
  // SQL: lower(regexp_replace(coalesce(desc,''), '\s+', ' ', 'g')) — note: NO trim
  const descNorm = (description ?? '').replace(/\s+/g, ' ').toLowerCase()
  const tail = ref !== '' ? ref : descNorm
  const payload = [
    userId,
    (accountName ?? '').toLowerCase(),
    transactionDate,
    type,
    amount.toFixed(2),
    tail,
  ].join('|')
  return createHash('md5').update(payload, 'utf8').digest('hex')
}

export function sha256Hex(buf: Buffer | Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}
