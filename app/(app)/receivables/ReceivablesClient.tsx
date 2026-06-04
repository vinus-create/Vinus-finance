'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFabAction } from '@/lib/hooks/useFabAction'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import EmptyState from '@/components/ui/EmptyState'
import type { Receivable } from '@/lib/types/app.types'
import { cn } from '@/lib/utils'

interface Props {
  unpaid: Receivable[]
  paid: Receivable[]
}

export default function ReceivablesClient({ unpaid, paid }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  useFabAction(() => setAddOpen(true))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [debtorName, setDebtorName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  function resetForm() {
    setDebtorName(''); setAmount(''); setDescription(''); setDueDate(''); setError(null)
  }

  async function handleAdd() {
    if (!debtorName.trim() || !amount) { setError(t.form_err_receivable); return }
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)
      const { error: e } = await supabase.from('receivables').insert({
        user_id: user.id,
        debtor_name: debtorName.trim(),
        amount: parseFloat(amount),
        description: description.trim() || null,
        due_date: dueDate || null,
        is_paid: false,
      })
      if (e) throw new Error(e.message)
      setAddOpen(false); resetForm(); router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally { setSaving(false) }
  }

  async function handleMarkPaid(id: string) {
    const supabase = createClient()
    await supabase.from('receivables').update({
      is_paid: true,
      paid_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm(t.receivable_delete_confirm)) return
    const supabase = createClient()
    await supabase.from('receivables').delete().eq('id', id)
    router.refresh()
  }

  function ReceivableCard({ item }: { item: Receivable }) {
    const today = new Date().toISOString().slice(0, 10)
    const isOverdue = !item.is_paid && item.due_date && item.due_date < today

    return (
      <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{item.debtor_name}</p>
            {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
            {item.due_date && !item.is_paid && (
              <p className={cn('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                {isOverdue ? t.receivable_overdue : `${t.receivable_due}: ${item.due_date}`}
              </p>
            )}
            {item.is_paid && item.paid_date && (
              <p className="text-xs text-emerald-600">{t.receivable_paid_on} {item.paid_date}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-amber-600">RM {item.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
            <button onClick={() => handleDelete(item.id)} className="text-xs text-muted-foreground hover:text-red-500 mt-0.5">删除</button>
          </div>
        </div>
        {!item.is_paid && (
          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(item.id)}
            className="w-full h-8 text-xs border-emerald-300 text-emerald-600 hover:bg-emerald-50">
            {t.receivable_mark_paid}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 mt-4 pb-24">
      <Tabs defaultValue="unpaid">
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="unpaid">{t.receivables_unpaid_tab} ({unpaid.length})</TabsTrigger>
          <TabsTrigger value="paid">{t.receivables_paid_tab} ({paid.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="unpaid" className="space-y-3">
          {unpaid.length === 0
            ? <EmptyState emoji="🤝" title={t.receivables_empty} body={t.receivables_empty_hint} />
            : unpaid.map(r => <ReceivableCard key={r.id} item={r} />)
          }
        </TabsContent>

        <TabsContent value="paid" className="space-y-3">
          {paid.length === 0
            ? <EmptyState emoji="✅" title={t.receivables_paid_empty} body="" />
            : paid.map(r => <ReceivableCard key={r.id} item={r} />)
          }
        </TabsContent>
      </Tabs>


      {/* Add Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe">
          <SheetHeader className="mb-4"><SheetTitle>{t.form_add_receivable}</SheetTitle></SheetHeader>
          <div className="space-y-3 px-1 pb-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.form_debtor_name}</p>
              <Input value={debtorName} onChange={e => setDebtorName(e.target.value)} placeholder={t.form_debtor_placeholder} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.form_receivable_amount}</p>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="100.00" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.form_receivable_desc}</p>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="例：借去买东西、飞机票" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.form_receivable_due}</p>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button onClick={handleAdd} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-white h-11">
              {saving ? t.loading : t.form_save_receivable}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
