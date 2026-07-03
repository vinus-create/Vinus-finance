import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/ingest/batch/[id] — remove an import batch and all its transactions.
// The balance trigger (migration 001) reverses account effects on row delete.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ownership check — RLS also guards, but fail loudly instead of silently deleting nothing
  const { data: batch } = await supabase
    .from('import_batches')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const { error: txErr, count } = await supabase
    .from('transactions')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .eq('import_batch_id', id)
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  const { error: batchErr } = await supabase
    .from('import_batches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, deletedTransactions: count ?? 0 })
}
