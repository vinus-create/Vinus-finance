'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import AddBillSheet, { type MonthlyBill } from './AddBillSheet'
import EmptyState from '@/components/ui/EmptyState'

interface Props {
  initialBills: MonthlyBill[]
}

function ordinal(n: number) {
  if (n >= 11 && n <= 13) return `${n}th`
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 10
  return `${n}${s[v] ?? 'th'}`
}

export default function BillsClient({ initialBills }: Props) {
  const router = useRouter()
  const [bills, setBills] = useState<MonthlyBill[]>(initialBills)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<MonthlyBill | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openAdd() { setEditingBill(null); setSheetOpen(true) }
  function openEdit(b: MonthlyBill) { setEditingBill(b); setSheetOpen(true) }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个账单吗？')) return
    setDeletingId(id)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('monthly_bills').update({ is_active: false }).eq('id', id)
      if (error) throw error
      setBills(prev => prev.filter(b => b.id !== id))
      toast.success('账单已删除')
    } catch {
      toast.error('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  function handleSaved() {
    router.refresh()
    // Optimistically reload
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('monthly_bills').select('*').eq('user_id', user.id).eq('is_active', true)
        .order('due_day').then(({ data }) => { if (data) setBills(data as MonthlyBill[]) })
    })
  }

  // Group by upcoming due day this month
  const today = new Date().getDate()
  const upcoming = bills.filter(b => b.due_day >= today)
  const past = bills.filter(b => b.due_day < today)

  return (
    <>
      {bills.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title="没有每月账单"
          body="添加固定账单，如电费、Unifi、水费等"
        />
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">本月待缴</p>
              <div className="space-y-2">
                {upcoming.map(b => <BillCard key={b.id} bill={b} onEdit={openEdit} onDelete={handleDelete} deletingId={deletingId} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">本月已过期</p>
              <div className="space-y-2 opacity-60">
                {past.map(b => <BillCard key={b.id} bill={b} onEdit={openEdit} onDelete={handleDelete} deletingId={deletingId} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={openAdd}
        className="fixed bottom-24 right-4 bg-emerald-500 text-white px-5 py-3 rounded-full shadow-lg shadow-emerald-500/30 text-sm font-semibold active:scale-95 transition-transform"
      >
        + 添加账单
      </button>

      <AddBillSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={handleSaved}
        editing={editingBill}
      />
    </>
  )
}

function BillCard({ bill, onEdit, onDelete, deletingId }: {
  bill: MonthlyBill
  onEdit: (b: MonthlyBill) => void
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  const today = new Date().getDate()
  const daysLeft = bill.due_day - today
  const isDue = daysLeft <= 3 && daysLeft >= 0
  const isOverdue = daysLeft < 0
  const [paying, setPaying] = useState(false)

  async function handlePay() {
    if (!bill.auto_deduct_account) return
    if (!confirm(`从「${bill.auto_deduct_account}」扣除 RM ${Number(bill.amount).toFixed(2)}？`)) return
    setPaying(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      // Record expense transaction
      const today = new Date().toISOString().slice(0, 10)
      const { error: txnErr } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'expense',
        amount: Number(bill.amount),
        currency: 'MYR',
        expense_category: bill.expense_category ?? 'other_expense',
        merchant_name: bill.name,
        description: bill.name,
        account_name: bill.auto_deduct_account,
        transaction_date: today,
        ledger: 'personal',
        is_tax_deductible: false,
      })
      if (txnErr) throw new Error(txnErr.message)

      // Deduct from account balance
      const { data: acct } = await supabase.from('accounts').select('id, balance')
        .eq('user_id', user.id).eq('name', bill.auto_deduct_account).maybeSingle()
      if (acct) await supabase.from('accounts').update({ balance: acct.balance - Number(bill.amount) }).eq('id', acct.id)

      toast.success(`已从 ${bill.auto_deduct_account} 扣除 RM ${Number(bill.amount).toFixed(2)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '扣款失败')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <span className="text-2xl shrink-0">{bill.emoji}</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{bill.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">每月 {bill.due_day} 日</span>
            {isDue && <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">⚡ {daysLeft === 0 ? '今天到期' : `${daysLeft} 天后`}</span>}
            {isOverdue && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">已过</span>}
          </div>
          <div className="flex gap-2 mt-1 flex-wrap">
            {bill.auto_remind && <span className="text-[10px] text-blue-500">🔔 提醒</span>}
            {bill.auto_deduct_account && (
              <span className="text-[10px] text-emerald-600">💳 {bill.auto_deduct_account}</span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-red-500">−RM {Number(bill.amount).toFixed(2)}</p>
          <div className="flex gap-1.5 mt-2 justify-end">
            <button onClick={() => onEdit(bill)} className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/70 transition-colors">
              编辑
            </button>
            <button
              onClick={() => onDelete(bill.id)}
              disabled={deletingId === bill.id}
              className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/30 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      </div>

      {/* Deduct button — only if auto_deduct_account is set */}
      {bill.auto_deduct_account && (
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full py-2.5 text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.99] transition-all"
        >
          {paying ? '扣款中...' : `💳 从 ${bill.auto_deduct_account} 扣款`}
        </button>
      )}
    </div>
  )
}
