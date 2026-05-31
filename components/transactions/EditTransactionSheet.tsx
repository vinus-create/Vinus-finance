'use client'

import { useState, useEffect } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORY_MAP, INCOME_CATEGORY_MAP } from '@/lib/constants/categories'
import { cn } from '@/lib/utils'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { ExpenseCategory, IncomeCategory, TransactionType, LedgerType } from '@/lib/types/app.types'
import type { Account } from '@/lib/types/app.types'

interface Txn {
  id: string
  type: TransactionType
  amount: number
  currency: string
  description: string | null
  merchant_name: string | null
  expense_category: string | null
  income_category: string | null
  transaction_date: string
  account_name: string
  ledger?: LedgerType
}

interface Props {
  txn: Txn
  open: boolean
  onClose: () => void
  onSaved: () => void
}

function accountEmoji(type: Account['account_type']): string {
  const map: Record<string, string> = { bank: '🏦', ewallet: '💳', investment: '📈', cash: '💵', credit_card: '💳', other: '🏧' }
  return map[type] ?? '🏦'
}

export default function EditTransactionSheet({ txn, open, onClose, onSaved }: Props) {
  const { t } = useLang()
  const [type, setType] = useState<TransactionType>(txn.type)
  const [amount, setAmount] = useState(txn.amount)
  const [description, setDescription] = useState(txn.merchant_name || txn.description || '')
  const [date, setDate] = useState(txn.transaction_date)
  const [accountName, setAccountName] = useState(txn.account_name)
  const [expenseCat, setExpenseCat] = useState<ExpenseCategory | null>(txn.expense_category as ExpenseCategory | null)
  const [incomeCat, setIncomeCat] = useState<IncomeCategory | null>(txn.income_category as IncomeCategory | null)
  const [ledger, setLedger] = useState<LedgerType>(txn.ledger ?? 'personal')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCatPicker, setShowCatPicker] = useState(false)

  // Reset state when txn changes
  useEffect(() => {
    setType(txn.type)
    setAmount(txn.amount)
    setDescription(txn.merchant_name || txn.description || '')
    setDate(txn.transaction_date)
    setAccountName(txn.account_name)
    setLedger(txn.ledger ?? 'personal')
    setExpenseCat(txn.expense_category as ExpenseCategory | null)
    setIncomeCat(txn.income_category as IncomeCategory | null)
    setError(null)
    setShowCatPicker(false)
  }, [txn])

  // Load accounts
  useEffect(() => {
    if (!open) return
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at')
      if (data) setAccounts(data as Account[])
    }
    load()
  }, [open])

  function handleTypeChange(newType: TransactionType) {
    setType(newType)
    if (newType === 'expense') { setExpenseCat(expenseCat ?? 'other_expense'); setIncomeCat(null) }
    else if (newType === 'income') { setIncomeCat(incomeCat ?? 'other_income'); setExpenseCat(null) }
    else { setExpenseCat(null); setIncomeCat(null) }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Session expired')

      // Update transaction
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          type,
          amount,
          description: description || null,
          merchant_name: description || null,
          expense_category: type === 'expense' ? expenseCat : null,
          income_category: type === 'income' ? incomeCat : null,
          transaction_date: date,
          account_name: accountName,
          ledger,
        })
        .eq('id', txn.id)
        .eq('user_id', user.id)
      if (updateError) throw new Error(updateError.message)

      // Reverse old balance impact on old account
      const oldImpact = txn.type === 'income' ? txn.amount : -txn.amount
      const newImpact = type === 'income' ? amount : -amount

      if (txn.account_name === accountName) {
        // Same account: apply net delta
        const delta = newImpact - oldImpact
        if (delta !== 0) {
          const { data: acct } = await supabase.from('accounts').select('id, balance').eq('user_id', user.id).eq('name', accountName).maybeSingle()
          if (acct) await supabase.from('accounts').update({ balance: acct.balance + delta }).eq('id', acct.id)
        }
      } else {
        // Different accounts: reverse old, apply new
        const { data: oldAcct } = await supabase.from('accounts').select('id, balance').eq('user_id', user.id).eq('name', txn.account_name).maybeSingle()
        if (oldAcct) await supabase.from('accounts').update({ balance: oldAcct.balance - oldImpact }).eq('id', oldAcct.id)
        const { data: newAcct } = await supabase.from('accounts').select('id, balance').eq('user_id', user.id).eq('name', accountName).maybeSingle()
        if (newAcct) await supabase.from('accounts').update({ balance: newAcct.balance + newImpact }).eq('id', newAcct.id)
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const currentCatMeta = type === 'expense' && expenseCat
    ? EXPENSE_CATEGORY_MAP[expenseCat]
    : type === 'income' && incomeCat
    ? INCOME_CATEGORY_MAP[incomeCat]
    : null

  return (
    <Drawer open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base">{t.edit_txn_title}</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-3 overflow-y-auto">
          {/* Type switcher */}
          <div className="grid grid-cols-3 gap-1.5">
            {(['expense', 'income', 'transfer'] as const).map(tp => (
              <button
                key={tp}
                onClick={() => handleTypeChange(tp)}
                className={`py-2 text-xs rounded-lg border transition-colors ${
                  type === tp ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:bg-muted'
                }`}
              >
                {tp === 'expense' ? t.preview_type_expense : tp === 'income' ? t.preview_type_income : t.preview_type_transfer}
              </button>
            ))}
          </div>

          {/* Personal / Business ledger toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">{t.ledger_label}:</span>
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {(['personal', 'business'] as LedgerType[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLedger(l)}
                  className={`px-3 py-1.5 transition-colors ${
                    ledger === l
                      ? 'bg-emerald-500 text-white font-semibold'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {l === 'personal' ? `👤 ${t.ledger_personal}` : `🏪 ${t.ledger_business}`}
                </button>
              ))}
            </div>
          </div>

          {/* Description + Amount */}
          <div className="grid grid-cols-5 gap-2">
            <Input
              className="col-span-3 h-10 text-sm bg-background"
              placeholder={t.edit_txn_name_placeholder}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <Input
              type="number"
              step="0.01"
              className="col-span-2 h-10 text-sm bg-background"
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Date */}
          <Input
            type="date"
            className="h-10 text-sm bg-background"
            value={date}
            onChange={e => setDate(e.target.value)}
          />

          {/* Category picker */}
          {type !== 'transfer' && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t.edit_txn_category_label}</p>
              <button
                onClick={() => setShowCatPicker(!showCatPicker)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-muted transition-colors"
              >
                <span className="text-lg">{currentCatMeta?.icon ?? '📌'}</span>
                <span className="flex-1 text-left">{currentCatMeta?.label ?? t.edit_txn_category_placeholder}</span>
                <span className="text-muted-foreground text-xs">{showCatPicker ? '▲' : '▼'}</span>
              </button>
              {showCatPicker && (
                <div className="grid grid-cols-4 gap-1 max-h-52 overflow-y-auto p-1 bg-muted/30 rounded-lg">
                  {(type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => {
                        if (type === 'expense') setExpenseCat(cat.value as ExpenseCategory)
                        else setIncomeCat(cat.value as IncomeCategory)
                        setShowCatPicker(false)
                      }}
                      className={cn(
                        'flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-[10px] transition-colors',
                        (type === 'expense' ? expenseCat : incomeCat) === cat.value
                          ? 'bg-emerald-500 text-white'
                          : 'bg-background hover:bg-muted'
                      )}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="leading-tight text-center line-clamp-2">{cat.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Account picker */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t.preview_account_label}</p>
            <div className="flex gap-1.5 flex-wrap">
              {accounts.map(acct => (
                <button
                  key={acct.id}
                  onClick={() => setAccountName(acct.name)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                    accountName === acct.name
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <span>{accountEmoji(acct.account_type)}</span>
                  <span>{acct.name}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
            <Button
              className="bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={handleSave}
              disabled={saving || amount <= 0}
            >
              {saving ? t.edit_txn_saving : `💾 ${t.save}`}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
