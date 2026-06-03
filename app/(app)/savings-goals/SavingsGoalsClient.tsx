'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import EmptyState from '@/components/ui/EmptyState'
import type { SavingsGoal } from '@/lib/types/app.types'
import { cn } from '@/lib/utils'

const EMOJIS = ['🎯', '🏠', '🚗', '✈️', '💍', '🎓', '💻', '📱', '🏖️', '💰', '🎁', '🛒']
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

interface Props {
  active: SavingsGoal[]
  completed: SavingsGoal[]
}

export default function SavingsGoalsClient({ active, completed }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add form state
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [color, setColor] = useState('#10b981')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('0')
  const [targetDate, setTargetDate] = useState('')

  function resetForm() {
    setName(''); setEmoji('🎯'); setColor('#10b981')
    setTargetAmount(''); setCurrentAmount('0'); setTargetDate('')
    setError(null)
  }

  async function handleAdd() {
    if (!name.trim() || !targetAmount) { setError(t.form_err_goal); return }
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)
      const { error: e } = await supabase.from('savings_goals').insert({
        user_id: user.id,
        name: name.trim(),
        emoji,
        color,
        target_amount: parseFloat(targetAmount),
        current_amount: parseFloat(currentAmount) || 0,
        target_date: targetDate || null,
        is_completed: false,
      })
      if (e) throw new Error(e.message)
      setAddOpen(false); resetForm(); router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally { setSaving(false) }
  }

  async function handleDeposit() {
    if (!depositGoal || !depositAmount) return
    setSaving(true)
    try {
      const supabase = createClient()
      const newAmount = depositGoal.current_amount + parseFloat(depositAmount)
      const isCompleted = newAmount >= depositGoal.target_amount
      await supabase.from('savings_goals').update({
        current_amount: newAmount,
        is_completed: isCompleted,
        updated_at: new Date().toISOString(),
      }).eq('id', depositGoal.id)
      setDepositGoal(null); setDepositAmount(''); router.refresh()
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.goal_delete_confirm)) return
    const supabase = createClient()
    await supabase.from('savings_goals').delete().eq('id', id)
    router.refresh()
  }

  function GoalCard({ goal }: { goal: SavingsGoal }) {
    const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
    const remaining = Math.max(0, goal.target_amount - goal.current_amount)
    const today = new Date().toISOString().slice(0, 10)
    const isOverdue = !goal.is_completed && goal.target_date && goal.target_date < today

    return (
      <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{goal.emoji}</span>
            <div>
              <p className="font-semibold text-sm">{goal.name}</p>
              {goal.is_completed ? (
                <span className="text-xs text-emerald-600 font-medium">{t.goal_completed_badge}</span>
              ) : goal.target_date ? (
                <p className={cn('text-xs', isOverdue ? 'text-red-500' : 'text-muted-foreground')}>
                  {isOverdue ? t.receivable_overdue : `${t.goal_target_date}: ${goal.target_date}`}
                </p>
              ) : null}
            </div>
          </div>
          <button onClick={() => handleDelete(goal.id)} className="text-muted-foreground hover:text-red-500 text-lg leading-none px-1">×</button>
        </div>

        <div className="space-y-1">
          <Progress value={pct} className="h-2.5" style={{ '--progress-color': goal.color } as React.CSSProperties} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t.goal_saved}: RM {goal.current_amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-muted-foreground">{t.goal_target}: </span>
            <span className="font-medium">RM {goal.target_amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
          </div>
          {!goal.is_completed && (
            <div className="text-right">
              <span className="text-muted-foreground">{t.goal_remaining}: </span>
              <span className="font-medium text-orange-500">RM {remaining.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        {!goal.is_completed && (
          <Button size="sm" onClick={() => { setDepositGoal(goal); setDepositAmount('') }}
            className="w-full h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs">
            {t.goal_deposit_btn}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 mt-4 pb-24 space-y-4">
      {/* Active goals */}
      {active.length === 0 && completed.length === 0 ? (
        <EmptyState emoji="🎯" title={t.savings_goals_empty} body={t.savings_goals_empty_hint} />
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.savings_goals_active}</p>
              {active.map(g => <GoalCard key={g.id} goal={g} />)}
            </div>
          )}
          {completed.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.savings_goals_completed}</p>
              {completed.map(g => <GoalCard key={g.id} goal={g} />)}
            </div>
          )}
        </>
      )}

      {/* FAB */}
      <button onClick={() => { resetForm(); setAddOpen(true) }}
        className="fixed bottom-20 right-4 flex items-center gap-1.5 px-5 h-12 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 text-white text-sm font-semibold active:scale-95 transition-transform z-40">
        {t.savings_goals_add_btn}
      </button>

      {/* Add Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe">
          <SheetHeader className="mb-4"><SheetTitle>{t.form_add_goal}</SheetTitle></SheetHeader>
          <div className="space-y-4 px-1 pb-6">
            {/* Emoji picker */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t.form_goal_emoji}</p>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    className={cn('text-2xl w-10 h-10 rounded-xl border transition-colors', emoji === e ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border')}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">颜色</p>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={cn('w-7 h-7 rounded-full border-2 transition-transform', color === c ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.form_goal_name}</p>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="例：买车首付、旅行基金" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t.form_goal_target}</p>
                  <Input type="number" min="0" step="0.01" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="10000" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t.form_goal_current}</p>
                  <Input type="number" min="0" step="0.01" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.form_goal_date}</p>
                <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button onClick={handleAdd} disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11">
              {saving ? t.loading : t.form_save_goal}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Deposit Sheet */}
      <Sheet open={!!depositGoal} onOpenChange={v => { if (!v) setDepositGoal(null) }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle>{depositGoal?.emoji} {depositGoal?.name} — {t.goal_deposit_title}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-1 pb-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.goal_deposit_amount}</p>
              <Input type="number" min="0" step="0.01" autoFocus value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)} placeholder="100" />
            </div>
            <Button onClick={handleDeposit} disabled={saving || !depositAmount}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11">
              {saving ? t.loading : t.goal_deposit_save}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
