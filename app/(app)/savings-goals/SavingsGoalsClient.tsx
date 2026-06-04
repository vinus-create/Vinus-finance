'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFabAction } from '@/lib/hooks/useFabAction'
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

// ── Helpers ──────────────────────────────────────────────────────

function calcMonthsRemaining(targetDate: string): number {
  const today = new Date()
  const target = new Date(targetDate)
  return Math.max(0, (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()))
}

function calcMonthlyNeeded(goal: SavingsGoal): number | null {
  if (!goal.target_date) return null
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)
  if (remaining <= 0) return 0
  const months = calcMonthsRemaining(goal.target_date)
  if (months <= 0) return null   // overdue — can't divide by 0
  return Math.ceil(remaining / months)
}

function calcAgeAtDate(dob: string, targetDate: string): number {
  const d = new Date(dob)
  const t = new Date(targetDate)
  let age = t.getFullYear() - d.getFullYear()
  const mDiff = t.getMonth() - d.getMonth()
  if (mDiff < 0 || (mDiff === 0 && t.getDate() < d.getDate())) age--
  return age
}

// ─────────────────────────────────────────────────────────────────

interface Props {
  active: SavingsGoal[]
  completed: SavingsGoal[]
  userDob: string | null
}

export default function SavingsGoalsClient({ active, completed, userDob }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  useFabAction(() => setAddOpen(true))
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null)
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared form state (used by both Add and Edit)
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

  function openEdit(goal: SavingsGoal) {
    setName(goal.name)
    setEmoji(goal.emoji)
    setColor(goal.color)
    setTargetAmount(String(goal.target_amount))
    setCurrentAmount(String(goal.current_amount))
    setTargetDate(goal.target_date ?? '')
    setError(null)
    setEditGoal(goal)
  }

  async function handleEdit() {
    if (!editGoal || !name.trim() || !targetAmount) { setError(t.form_err_goal); return }
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      await supabase.from('savings_goals').update({
        name: name.trim(), emoji, color,
        target_amount: parseFloat(targetAmount),
        current_amount: parseFloat(currentAmount) || 0,
        target_date: targetDate || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editGoal.id)
      setEditGoal(null); resetForm(); router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally { setSaving(false) }
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
        name: name.trim(), emoji, color,
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
    const monthlyNeeded = calcMonthlyNeeded(goal)
    const monthsLeft = goal.target_date ? calcMonthsRemaining(goal.target_date) : null
    const ageAtTarget = (userDob && goal.target_date) ? calcAgeAtDate(userDob, goal.target_date) : null

    return (
      <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
        {/* Title row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{goal.emoji}</span>
            <div>
              <p className="font-semibold text-sm">{goal.name}</p>
              {goal.is_completed ? (
                <span className="text-xs text-emerald-600 font-medium">{t.goal_completed_badge}</span>
              ) : goal.target_date ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                    {isOverdue ? t.receivable_overdue : `${goal.target_date}`}
                  </p>
                  {ageAtTarget !== null && ageAtTarget > 0 && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-medium">
                      届时 {ageAtTarget} 岁
                    </span>
                  )}
                  {monthsLeft !== null && monthsLeft > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      剩 {monthsLeft} 个月
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => openEdit(goal)}
              className="text-xs text-muted-foreground hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-muted transition-colors">
              编辑
            </button>
            <button onClick={() => handleDelete(goal.id)}
              className="text-muted-foreground hover:text-red-500 text-lg leading-none px-1">×</button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={pct} className="h-2.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t.goal_saved}: RM {goal.current_amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">{t.goal_target}: </span>
            <span className="font-medium">RM {goal.target_amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
          </div>
          {!goal.is_completed && remaining > 0 && (
            <div className="text-right">
              <span className="text-muted-foreground">{t.goal_remaining}: </span>
              <span className="font-medium text-orange-500">RM {remaining.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        {/* Monthly needed chip */}
        {!goal.is_completed && monthlyNeeded !== null && monthlyNeeded > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <span className="text-base">📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">每月需存</p>
              <p className="text-sm font-bold text-blue-600">
                RM {monthlyNeeded.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                <span className="text-[10px] font-normal text-muted-foreground ml-1">/ 月 × {monthsLeft} 个月</span>
              </p>
            </div>
          </div>
        )}
        {!goal.is_completed && isOverdue && (
          <p className="text-xs text-red-500 font-medium">⚠️ 已超过目标日期</p>
        )}

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
      {/* No DOB hint */}
      {!userDob && active.some(g => g.target_date) && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-400">
          <span>🎂</span>
          <p>在<strong>设置 → 个人资料</strong>填写出生日期，可显示达成目标时的年龄</p>
        </div>
      )}

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


      {/* Add Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe">
          <SheetHeader className="mb-4"><SheetTitle>{t.form_add_goal}</SheetTitle></SheetHeader>
          <div className="space-y-4 px-1 pb-6">
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

      {/* Edit Sheet */}
      <Sheet open={!!editGoal} onOpenChange={v => { if (!v) { setEditGoal(null); resetForm() } }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe">
          <SheetHeader className="mb-4"><SheetTitle>✏️ 编辑目标</SheetTitle></SheetHeader>
          <div className="space-y-4 px-1 pb-6">
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
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t.form_goal_target}</p>
                  <Input type="number" min="0" step="0.01" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t.form_goal_current}</p>
                  <Input type="number" min="0" step="0.01" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.form_goal_date}</p>
                <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button onClick={handleEdit} disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11">
              {saving ? t.loading : '💾 保存更改'}
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
