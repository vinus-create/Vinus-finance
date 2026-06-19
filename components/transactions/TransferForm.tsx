'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/types/app.types'

function accountEmoji(type: Account['account_type']): string {
  const map: Record<string, string> = { bank: '🏦', ewallet: '💳', investment: '📈', cash: '💵', credit_card: '💳', other: '🏧' }
  return map[type] ?? '🏦'
}

interface Props {
  onSaved: () => void
}

export default function TransferForm({ onSaved }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at').then(({ data }) => {
        if (data && data.length >= 2) {
          setAccounts(data as Account[])
          setFromAccount(data[0]!.name)
          setToAccount(data[1]!.name)
        } else if (data) {
          setAccounts(data as Account[])
        }
      })
    })
  }, [])

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!fromAccount || !toAccount || !amt || amt <= 0) {
      setError('请填写所有必填项')
      return
    }
    if (fromAccount === toAccount) {
      setError('来源和目标户口不能相同')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      // Insert transfer transaction
      const { error: insertErr } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'transfer',
        amount: amt,
        currency: 'MYR',
        merchant_name: note.trim() || `${fromAccount} → ${toAccount}`,
        description: note.trim() || null,
        transaction_date: date,
        transaction_time: time || null,
        account_name: fromAccount,
        to_account_name: toAccount,
        ledger: 'personal',
        is_tax_deductible: false,
      })
      if (insertErr) throw new Error(insertErr.message)

      // Balances (from −, to +) are handled by DB trigger trg_update_account_balance
      // (migration 001) — do not update them here or transfers double-count.

      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (accounts.length < 2) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        <p className="text-2xl mb-2">🏦</p>
        <p>需要至少 2 个户口才能转账</p>
        <p className="text-xs mt-1">请先在「户口」页面添加户口</p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* From → To */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">从 (From)</Label>
          <div className="flex flex-col gap-1.5">
            {accounts.map(acct => (
              <button
                key={acct.id}
                onClick={() => {
                  setFromAccount(acct.name)
                  if (toAccount === acct.name) setToAccount(accounts.find(a => a.name !== acct.name)?.name ?? '')
                }}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border text-left transition-colors ${
                  fromAccount === acct.name
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <span>{accountEmoji(acct.account_type)}</span>
                <span className="truncate">{acct.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">到 (To)</Label>
          <div className="flex flex-col gap-1.5">
            {accounts.map(acct => (
              <button
                key={acct.id}
                onClick={() => {
                  setToAccount(acct.name)
                  if (fromAccount === acct.name) setFromAccount(accounts.find(a => a.name !== acct.name)?.name ?? '')
                }}
                disabled={fromAccount === acct.name}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border text-left transition-colors ${
                  toAccount === acct.name
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : fromAccount === acct.name
                    ? 'border-border opacity-30 cursor-not-allowed'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <span>{accountEmoji(acct.account_type)}</span>
                <span className="truncate">{acct.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Arrow indicator */}
      {fromAccount && toAccount && (
        <div className="text-center text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{fromAccount}</span>
          <span className="mx-2">→</span>
          <span className="font-medium text-foreground">{toAccount}</span>
        </div>
      )}

      {/* Amount */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">金额 (RM)</Label>
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={e => { const m = e.target.value.match(/^\d*(\.\d{0,2})?/); setAmount(m ? m[0] : '') }}
          className="h-11 text-lg font-semibold"
          autoFocus
        />
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">日期</Label>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">时间（选填）</Label>
          <Input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">备注（选填）</Label>
        <Input
          placeholder="例：转账买车贷"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="h-10"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button
        className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
        onClick={handleSave}
        disabled={saving || !fromAccount || !toAccount || !amount}
      >
        {saving ? '保存中...' : '↔️ 确认转账'}
      </Button>
    </div>
  )
}
