'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Account } from '@/lib/types/app.types'

const BILL_PRESETS = [
  { emoji: '💡', name: 'TNB (Electricity)', category: 'electricity_tnb' },
  { emoji: '💧', name: 'Water Bill', category: 'water_syabas' },
  { emoji: '🌐', name: 'Unifi / Internet', category: 'internet_telco' },
  { emoji: '📱', name: 'Phone Bill', category: 'internet_telco' },
  { emoji: '🏠', name: 'Maintenance Fee', category: 'rent_mortgage' },
  { emoji: '🔒', name: 'Insurance', category: 'insurance' },
  { emoji: '🎬', name: 'Netflix / Streaming', category: 'subscription' },
  { emoji: '🅿️', name: 'Parking', category: 'parking' },
  { emoji: '🏋️', name: 'Gym', category: 'gym' },
  { emoji: '📦', name: 'Other', category: 'other_expense' },
]

export interface MonthlyBill {
  id: string
  name: string
  amount: number
  due_day: number
  frequency_months: number
  expense_category: string | null
  emoji: string
  is_active: boolean
  auto_remind: boolean
  auto_budget: boolean
  auto_deduct_account: string | null
  notes: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editing?: MonthlyBill | null
}

export default function AddBillSheet({ open, onOpenChange, onSaved, editing }: Props) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [emoji, setEmoji] = useState('💡')
  const [category, setCategory] = useState('electricity_tnb')
  const [frequencyMonths, setFrequencyMonths] = useState(1)
  const [autoRemind, setAutoRemind] = useState(false)
  const [autoDeductAccount, setAutoDeductAccount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])

  const loadAccounts = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at')
    if (data) setAccounts(data as Account[])
  }, [])

  useEffect(() => {
    if (open) {
      loadAccounts()
      if (editing) {
        setName(editing.name)
        setAmount(editing.amount.toFixed(2))
        setDueDay(String(editing.due_day))
        setEmoji(editing.emoji)
        setCategory(editing.expense_category ?? 'other_expense')
        setFrequencyMonths(editing.frequency_months ?? 1)
        setAutoRemind(editing.auto_remind)
        setAutoDeductAccount(editing.auto_deduct_account ?? '')
        setNotes(editing.notes ?? '')
      } else {
        setName(''); setAmount(''); setDueDay('1'); setEmoji('💡')
        setFrequencyMonths(1)
        setCategory('electricity_tnb'); setAutoRemind(false); setAutoDeductAccount(''); setNotes('')
      }
    }
  }, [open, editing, loadAccounts])

  function selectPreset(p: typeof BILL_PRESETS[0]) {
    setEmoji(p.emoji)
    setCategory(p.category)
    if (!name || BILL_PRESETS.some(x => x.name === name)) setName(p.name)
  }

  async function handleSave() {
    if (!name.trim() || !amount) return
    const amt = parseFloat(amount)
    const day = parseInt(dueDay)
    if (isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 31) return

    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const payload = {
        user_id: user.id,
        name: name.trim(),
        amount: amt,
        due_day: day,
        expense_category: category,
        emoji,
        frequency_months: frequencyMonths,
        auto_remind: autoRemind,
        auto_budget: false,
        auto_deduct_account: autoDeductAccount.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      let billId = editing?.id
      if (editing) {
        const { error } = await supabase.from('monthly_bills').update(payload).eq('id', editing.id)
        if (error) throw new Error(error.message)
      } else {
        const { data, error } = await supabase.from('monthly_bills').insert({ ...payload, is_active: true }).select('id').single()
        if (error) throw new Error(error.message)
        billId = data.id
      }

      // Sync reminder if toggled on
      if (autoRemind && billId) {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        const lastDay = new Date(year, month, 0).getDate()
        const clampedDay = Math.min(day, lastDay)
        const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`

        // Upsert reminder (delete old + insert new on edit, just insert on create)
        await supabase.from('reminders').insert({
          user_id: user.id,
          title: name.trim(),
          amount: amt,
          currency: 'MYR',
          due_date: dueDate,
          frequency: 'monthly',
          status: 'active',
          notify_push: true,
          notify_email: false,
          days_before: 3,
        })
      }

      toast.success(editing ? '账单已更新' : '账单已添加')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] overflow-y-auto">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{editing ? '编辑账单' : '添加每月账单'}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 mt-3">
          {/* Presets */}
          {!editing && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">快选</Label>
              <div className="flex flex-wrap gap-2">
                {BILL_PRESETS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => selectPreset(p)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors ${
                      emoji === p.emoji && category === p.category
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span>{p.emoji}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name + emoji */}
          <div className="flex gap-2">
            <div className="w-16 space-y-1.5">
              <Label className="text-xs text-muted-foreground">图标</Label>
              <Input
                className="h-11 text-2xl text-center"
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
                maxLength={2}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">账单名称</Label>
              <Input
                className="h-11"
                placeholder="例：TNB 电费"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Amount + due day */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">金额 (RM)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">每月几号到期</Label>
              <Input
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {/* Payment frequency */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">缴付频率</Label>
            <div className="flex flex-wrap gap-2">
              {[1,2,3,4,6,12].map(m => (
                <button
                  key={m}
                  onClick={() => setFrequencyMonths(m)}
                  className={`text-xs px-3 py-2 rounded-xl border font-medium transition-colors ${
                    frequencyMonths === m
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {m === 1 ? '每月' : m === 12 ? '每年' : `每 ${m} 个月`}
                </button>
              ))}
            </div>
            {/* Preview: actual payment per occurrence */}
            {parseFloat(amount) > 0 && (
              <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-lg">
                每次缴付：
                <span className="font-semibold text-foreground">
                  {frequencyMonths === 1
                    ? `RM ${parseFloat(amount).toFixed(2)}`
                    : `RM ${parseFloat(amount).toFixed(2)} × ${frequencyMonths} = RM ${(parseFloat(amount) * frequencyMonths).toFixed(2)}`}
                </span>
                {frequencyMonths > 1 && (
                  <span className="ml-2 text-muted-foreground">（月均 RM {parseFloat(amount).toFixed(2)}）</span>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">备注（选填）</Label>
            <Input
              placeholder="例：CIMB 自动扣"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3 p-3 rounded-xl bg-muted">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium">🔔 添加至账单提醒</p>
                <p className="text-xs text-muted-foreground">到期前 3 天提醒</p>
              </div>
              <button
                onClick={() => setAutoRemind(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${autoRemind ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoRemind ? 'translate-x-5' : ''}`} />
              </button>
            </label>
          </div>

          {/* Auto-deduct account */}
          <div className="space-y-2 p-3 rounded-xl bg-muted">
            <div>
              <p className="text-sm font-medium">💳 自动扣户口（选填）</p>
              <p className="text-xs text-muted-foreground">选择扣款户口后，在账单列表可一键扣除</p>
            </div>
            {accounts.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => setAutoDeductAccount('')}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    !autoDeductAccount ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:bg-background'
                  }`}
                >
                  不设定
                </button>
                {accounts.map(acct => (
                  <button
                    key={acct.id}
                    onClick={() => setAutoDeductAccount(acct.name)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      autoDeductAccount === acct.name
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-border hover:bg-background'
                    }`}
                  >
                    {acct.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">请先在户口页面添加户口</p>
            )}
          </div>

          <Button
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
            onClick={handleSave}
            disabled={saving || !name.trim() || !amount}
          >
            {saving ? '保存中...' : editing ? '更新账单' : '✅ 添加账单'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
