import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeDedupHash } from '@/lib/utils/dedup'
import type { IngestSaveRequest, SaveTransactionRow } from '@/lib/types/ingest.types'

// ─── POST /api/ingest/save ────────────────────────────────────
// Persists reviewed/edited parsed transactions. Single write path for the
// TransactionPreview UI so dedup, account auto-creation, batch bookkeeping
// and closing-balance sync all happen in one place.
//
// Body: IngestSaveRequest (JSON)
// Returns: { success, insertedIds, skippedDuplicates, createdAccounts }
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: IngestSaveRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const rows = (body.transactions ?? []).filter(t => t && t.amount > 0)
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'No transactions to save' }, { status: 400 })
  }

  const { data: accountRows } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('user_id', user.id)
  const existingNames = new Set((accountRows ?? []).map(a => a.name.toLowerCase()))
  const createdAccounts: string[] = []

  // 1. Confirmed account auto-discovery (from a parsed statement header)
  if (body.createAccount && !existingNames.has(body.createAccount.suggested_name.toLowerCase())) {
    const c = body.createAccount
    const { error: acctErr } = await supabase.from('accounts').insert({
      user_id: user.id,
      name: c.suggested_name,
      account_type: c.account_type === 'credit_card' ? 'credit_card' : c.account_type === 'ewallet' ? 'ewallet' : 'bank',
      institution: c.institution || null,
      account_number: c.last4 || null,
      balance: 0,                       // closing-balance sync below sets the real figure
      currency: 'MYR',
      is_active: true,
      include_in_net_worth: true,
      auto_created: true,
    })
    if (!acctErr) {
      existingNames.add(c.suggested_name.toLowerCase())
      createdAccounts.push(c.suggested_name)
    }
  }

  // 2. Create any other unknown account names referenced by the rows
  const referenced = new Set<string>()
  for (const t of rows) {
    if (t.account_name) referenced.add(t.account_name)
    if (t.type === 'transfer' && t.to_account_name) referenced.add(t.to_account_name)
  }
  for (const name of referenced) {
    if (!name || existingNames.has(name.toLowerCase())) continue
    const lower = name.toLowerCase()
    const typeGuess =
      lower.includes('cash') || lower.includes('现金') || lower.includes('tunai') ? 'cash'
      : /tng|touch|grabpay|shopeepay|boost|bigpay|mae/.test(lower) ? 'ewallet'
      : 'bank'
    const { error: e } = await supabase.from('accounts').insert({
      user_id: user.id, name, account_type: typeGuess, balance: 0,
      currency: 'MYR', is_active: true, include_in_net_worth: true, auto_created: true,
    })
    if (!e) { existingNames.add(lower); createdAccounts.push(name) }
  }

  // 3. Dedup safety net (idempotency: double-tap save / re-submitted batch).
  //    Rows the user explicitly overrode are always inserted.
  const toInsert: SaveTransactionRow[] = []
  let skippedDuplicates = 0
  {
    const hashes = rows.map(t => computeDedupHash(
      user.id, t.account_name, t.transaction_date, t.type,
      t.amount, t.reference_number ?? null, t.description || null,
    ))
    const { data: existing } = await supabase
      .from('transactions')
      .select('dedup_hash')
      .eq('user_id', user.id)
      .in('dedup_hash', [...new Set(hashes)])
    const dbCount = new Map<string, number>()
    for (const r of existing ?? []) {
      if (r.dedup_hash) dbCount.set(r.dedup_hash, (dbCount.get(r.dedup_hash) ?? 0) + 1)
    }
    const seen = new Map<string, number>()
    rows.forEach((t, i) => {
      const h = hashes[i]
      const nth = seen.get(h) ?? 0
      seen.set(h, nth + 1)
      const m = dbCount.get(h) ?? 0
      if (t.is_duplicate_override || nth >= m) toInsert.push(t)
      else skippedDuplicates++
    })
  }

  if (toInsert.length === 0) {
    if (body.batchId) {
      await supabase.from('import_batches')
        .update({ status: 'completed', inserted_rows: 0, duplicate_rows: skippedDuplicates })
        .eq('id', body.batchId).eq('user_id', user.id)
    }
    return NextResponse.json({ success: true, insertedIds: [], skippedDuplicates, createdAccounts })
  }

  // 4. Insert — the DB trigger applies all balance effects (incl. transfers)
  const insertRows = toInsert.map(t => ({
    user_id: user.id,
    type: t.type,
    amount: t.amount,
    currency: t.currency || 'MYR',
    expense_category: t.type === 'expense' ? t.expense_category : null,
    income_category: t.type === 'income' ? t.income_category : null,
    description: t.description || null,
    merchant_name: t.merchant_name || null,
    reference_number: t.reference_number ?? null,
    transaction_date: t.transaction_date,
    account_name: t.account_name || 'Cash',
    to_account_name: t.type === 'transfer' ? (t.to_account_name ?? null) : null,
    ledger: t.ledger === 'business' ? 'business' : 'personal',
    is_tax_deductible: t.is_tax_deductible === true,
    import_batch_id: body.batchId ?? null,
    is_duplicate_override: t.is_duplicate_override === true,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('transactions').insert(insertRows).select('id')

  if (insertError) {
    if (body.batchId) {
      await supabase.from('import_batches').update({ status: 'failed' })
        .eq('id', body.batchId).eq('user_id', user.id)
    }
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
  }
  const insertedIds = inserted?.map(r => r.id) ?? []

  // 5. Batch bookkeeping
  if (body.batchId) {
    await supabase.from('import_batches').update({
      status: 'completed',
      inserted_rows: insertedIds.length,
      duplicate_rows: skippedDuplicates,
      overridden_rows: toInsert.filter(t => t.is_duplicate_override).length,
    }).eq('id', body.batchId).eq('user_id', user.id)
  }

  // 6. Closing-balance sync — AFTER inserts so the statement snapshot wins,
  //    and only when this statement is newer than the last one imported.
  if (body.statementSync?.account_name && body.statementSync.closing_balance !== null) {
    const s = body.statementSync
    const { data: acct } = await supabase
      .from('accounts')
      .select('id, last_statement_date')
      .eq('user_id', user.id)
      .eq('name', s.account_name)
      .maybeSingle()
    if (acct) {
      const newer = !acct.last_statement_date || !s.statement_date
        || s.statement_date > acct.last_statement_date
      if (newer) {
        await supabase.from('accounts').update({
          balance: s.closing_balance,
          last_statement_date: s.statement_date ?? acct.last_statement_date,
          updated_at: new Date().toISOString(),
        }).eq('id', acct.id)
      }
    }
  }

  return NextResponse.json({ success: true, insertedIds, skippedDuplicates, createdAccounts })
}
