'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { EXPENSE_CATEGORY_MAP, INCOME_CATEGORY_MAP } from '@/lib/constants/categories'
import { cn } from '@/lib/utils'
import type { ParsedTransaction } from '@/lib/ai/parser'
import type { Account, LedgerType } from '@/lib/types/app.types'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { getCategoryLabel } from '@/lib/utils/category-i18n'
import type { LangCode } from '@/lib/i18n'
import SuccessCelebration from '@/components/ui/SuccessCelebration'
import type { DetectedAccount } from './PDFParser'
import { calcEpfSocso } from '@/lib/utils/epf-socso'
import { calcPcb } from '@/lib/utils/pcb'

interface Props {
  transactions: ParsedTransaction[]
  detectedAccount?: DetectedAccount | null
  onDiscard: () => void
  onSaved: () => void
}

function getTxnIcon(t: ParsedTransaction): string {
  if (t.type === 'expense' && t.expense_category) return EXPENSE_CATEGORY_MAP[t.expense_category]?.icon ?? '💸'
  if (t.type === 'income' && t.income_category) return INCOME_CATEGORY_MAP[t.income_category]?.icon ?? '💰'
  return '🔄'
}

function getTxnLabel(txn: ParsedTransaction, fallback: string, lang: LangCode): string {
  if (txn.type === 'expense' && txn.expense_category) return getCategoryLabel(txn.expense_category, 'expense', lang)
  if (txn.type === 'income' && txn.income_category) return getCategoryLabel(txn.income_category, 'income', lang)
  return fallback
}

function accountEmoji(type: Account['account_type']): string {
  const map: Record<string, string> = { bank: '🏦', ewallet: '💳', investment: '📈', cash: '💵', credit_card: '💳', other: '🏧' }
  return map[type] ?? '🏦'
}

export default function TransactionPreview({ transactions, detectedAccount, onDiscard, onSaved }: Props) {
  const [edited, setEdited] = useState<ParsedTransaction[]>(() => transactions.map(t => ({ ...t, to_account_name: t.to_account_name ?? null })))
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [customAccount, setCustomAccount] = useState<Record<number, string>>({})
  const [showCustomInput, setShowCustomInput] = useState<Record<number, boolean>>({})
  const [accounts, setAccounts] = useState<Account[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  // Global ledger: auto-default to business if any transaction has business_income
  const [globalLedger, setGlobalLedger] = useState<LedgerType>(() =>
    transactions.some(tx => tx.ledger === 'business') ? 'business' : 'personal'
  )
  // Income source — only salary triggers EPF/SOCSO/EIS
  type IncomeSource = 'salary' | 'side' | 'other'
  const [incomeSource, setIncomeSource] = useState<IncomeSource>('salary')
  // EPF / SOCSO / EIS / PCB individual toggles
  const [autoEpf, setAutoEpf] = useState(false)
  const [autoSocso, setAutoSocso] = useState(false)
  const [autoEis, setAutoEis] = useState(false)
  const [autoPcb, setAutoPcb] = useState(false)
  const [isMarried, setIsMarried] = useState(false)
  const { t, lang } = useLang()

  // ── Load user accounts ────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (data && data.length > 0) {
      setAccounts(data as Account[])
      return
    }
    // No accounts yet — show empty (accounts page will auto-create Cash on next visit)
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  // ── Per-transaction field update ──────────────────────────
  function update(idx: number, patch: Partial<ParsedTransaction>) {
    setEdited(prev => prev.map((txn, i) => i === idx ? { ...txn, ...patch } : txn))
  }

  // ── Account name resolution for a transaction ─────────────
  function resolvedAccountName(idx: number): string {
    if (showCustomInput[idx]) return customAccount[idx] ?? ''
    return edited[idx].account_name
  }

  function selectAccount(idx: number, name: string) {
    setShowCustomInput(prev => ({ ...prev, [idx]: false }))
    update(idx, { account_name: name })
  }

  function selectCustom(idx: number) {
    setShowCustomInput(prev => ({ ...prev, [idx]: true }))
    setCustomAccount(prev => ({ ...prev, [idx]: edited[idx].account_name }))
  }

  function commitCustom(idx: number, name: string) {
    if (name.trim()) update(idx, { account_name: name.trim() })
    setShowCustomInput(prev => ({ ...prev, [idx]: false }))
  }

  // ── Date sanitizer: fix AI confusion of DD/MM/YYYY → YYYY-DD-MM ──
  function sanitizeDate(dateStr: string): string {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return dateStr
    const [, year, month, day] = m
    // If month > 12 but day ≤ 12, AI swapped them — fix it
    if (parseInt(month) > 12 && parseInt(day) <= 12) {
      return `${year}-${day}-${month}`
    }
    // If both invalid, fall back to today
    if (parseInt(month) > 12) {
      return new Date().toISOString().slice(0, 10)
    }
    return dateStr
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.preview_error_session)

      const valid = edited.filter(txn => txn.amount > 0)
      const existingNames = new Set(accounts.map(a => a.name.toLowerCase()))

      // Auto-create accounts that don't exist
      const newNames = [...new Set(valid.map(txn => txn.account_name))]
        .filter(name => name && !existingNames.has(name.toLowerCase()))

      for (const name of newNames) {
        const typeGuess = name.toLowerCase().includes('cash') || name.toLowerCase().includes('现金') ? 'cash' : 'bank'
        const { data: newAcct } = await supabase
          .from('accounts')
          .insert({ user_id: user.id, name, account_type: typeGuess, balance: 0, currency: 'MYR', is_active: true, include_in_net_worth: true })
          .select('*')
          .single()
        if (newAcct) setAccounts(prev => [...prev, newAcct as Account])
      }

      const rows = valid.map(txn => ({
        user_id: user.id,
        type: txn.type,
        amount: txn.amount,
        currency: txn.currency,
        expense_category: txn.expense_category,
        income_category: txn.income_category,
        description: txn.description || null,
        merchant_name: txn.merchant_name || null,
        transaction_date: sanitizeDate(txn.transaction_date),
        account_name: detectedAccount?.name || txn.account_name,
        to_account_name: txn.type === 'transfer' ? (txn.to_account_name ?? null) : null,
        ledger: globalLedger,
        is_tax_deductible: txn.is_tax_deductible,
      }))

      const { error: insertError } = await supabase.from('transactions').insert(rows)
      if (insertError) throw new Error(insertError.message)

      // ── Update account balances ──────────────────────────────
      const deltaMap = new Map<string, number>()
      for (const row of rows) {
        if (row.type === 'transfer') {
          // Internal transfer: from loses, to gains
          deltaMap.set(row.account_name, (deltaMap.get(row.account_name) ?? 0) - row.amount)
          if (row.to_account_name) {
            deltaMap.set(row.to_account_name, (deltaMap.get(row.to_account_name) ?? 0) + row.amount)
          }
        } else {
          const delta = row.type === 'income' ? row.amount : -row.amount
          if (delta !== 0) deltaMap.set(row.account_name, (deltaMap.get(row.account_name) ?? 0) + delta)
        }
      }
      for (const [accountName, delta] of deltaMap) {
        const { data: acct } = await supabase
          .from('accounts').select('id, balance')
          .eq('user_id', user.id).eq('name', accountName).maybeSingle()
        if (acct) await supabase.from('accounts').update({ balance: acct.balance + delta }).eq('id', acct.id)
      }

      // ── EPF / SOCSO / EIS / PCB auto-deduction (salary only) ──
      const incomeRows = rows.filter(r => r.type === 'income')
      if (globalLedger === 'personal' && incomeSource === 'salary' && incomeRows.length > 0 && (autoEpf || autoSocso || autoEis || autoPcb)) {
        for (const row of incomeRows) {
          const epf = calcEpfSocso(row.amount)
          const today = row.transaction_date

          if (autoSocso) {
            await supabase.from('transactions').insert({
              user_id: user.id, type: 'expense', amount: epf.socsoEmployee,
              currency: 'MYR', expense_category: 'socso_perkeso',
              merchant_name: 'PERKESO/SOCSO', description: `SOCSO - ${row.merchant_name ?? '月薪'}`,
              account_name: row.account_name, transaction_date: today,
              ledger: 'personal', is_tax_deductible: false,
            })
          }

          if (autoEis) {
            await supabase.from('transactions').insert({
              user_id: user.id, type: 'expense', amount: epf.eisEmployee,
              currency: 'MYR', expense_category: 'socso_perkeso',
              merchant_name: 'EIS/PERKESO', description: `EIS - ${row.merchant_name ?? '月薪'}`,
              account_name: row.account_name, transaction_date: today,
              ledger: 'personal', is_tax_deductible: false,
            })
          }

          if (autoEpf) {
            // Upsert KWSP-EPF in stock_holdings (accumulate balance)
            const { data: existing } = await supabase.from('stock_holdings')
              .select('id, shares').eq('user_id', user.id).eq('ticker', 'KWSP-EPF').maybeSingle()

            if (existing) {
              await supabase.from('stock_holdings').update({
                shares: existing.shares + epf.epfEmployee,
                updated_at: new Date().toISOString(),
              }).eq('id', existing.id)
            } else {
              await supabase.from('stock_holdings').insert({
                user_id: user.id,
                ticker: 'KWSP-EPF',
                company_name: 'Kumpulan Wang Simpanan Pekerja (EPF)',
                asset_type: 'mutual_fund',
                shares: epf.epfEmployee,
                avg_cost_price: 1.00,
                currency: 'MYR',
                notes: 'Auto-tracked EPF contributions',
                is_active: true,
              })
            }

            // Record EPF as expense (deduction from account)
            await supabase.from('transactions').insert({
              user_id: user.id, type: 'expense', amount: epf.epfEmployee,
              currency: 'MYR', expense_category: 'epf_kwsp',
              merchant_name: 'KWSP/EPF', description: `EPF 11% - ${row.merchant_name ?? '月薪'}`,
              account_name: row.account_name, transaction_date: today,
              ledger: 'personal', is_tax_deductible: false,
            })
          }

          if (autoPcb) {
            const pcbResult = calcPcb(row.amount, isMarried)
            if (pcbResult.monthlyPcb > 0) {
              await supabase.from('transactions').insert({
                user_id: user.id, type: 'expense', amount: pcbResult.monthlyPcb,
                currency: 'MYR', expense_category: 'income_tax',
                merchant_name: 'LHDN/PCB', description: `PCB 月扣税 - ${row.merchant_name ?? '月薪'}`,
                account_name: row.account_name, transaction_date: today,
                ledger: 'personal', is_tax_deductible: false,
              })
            }
          }
        }
      }

      setShowCelebration(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.preview_error_save)
    } finally {
      setSaving(false)
    }
  }

  const valid = edited.filter(txn => txn.amount > 0)
  const saveLabel = valid.length > 1
    ? t.preview_save_many.replace('{n}', String(valid.length))
    : t.preview_save

  return (
    <div className="px-4 pb-4 space-y-3 relative">
      {showCelebration && <SuccessCelebration onDone={onSaved} />}

      {/* Detected account badge */}
      {detectedAccount && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
          detectedAccount.was_created
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
        }`}>
          <span className="text-base">🏦</span>
          <div>
            <p className="font-semibold">
              {detectedAccount.was_created ? '✨ New account created' : '✓ Linked to account'}
            </p>
            <p className="opacity-80">
              {detectedAccount.institution || detectedAccount.name}
              {detectedAccount.last4 && ` ••••${detectedAccount.last4}`}
              {detectedAccount.closing_balance !== null
                ? ` · Balance: RM ${detectedAccount.closing_balance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
                : ''}
            </p>
          </div>
        </div>
      )}

      {/* Personal / Business ledger toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground font-medium">{t.ledger_label}:</span>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['personal', 'business'] as LedgerType[]).map(l => (
            <button
              key={l}
              onClick={() => setGlobalLedger(l)}
              className={`px-3 py-1.5 transition-colors ${
                globalLedger === l
                  ? 'bg-emerald-500 text-white font-semibold'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {l === 'personal' ? `👤 ${t.ledger_personal}` : `🏪 ${t.ledger_business}`}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {valid.length} {t.preview_detected}
      </p>

      {/* Income source selector — only for personal income */}
      {globalLedger === 'personal' && valid.some(txn => txn.type === 'income') && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground font-medium shrink-0">收入来源:</span>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {([
              { value: 'salary', label: '💼 工资' },
              { value: 'side',   label: '💻 副业' },
              { value: 'other',  label: '💰 其他' },
            ] as { value: IncomeSource; label: string }[]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setIncomeSource(opt.value)}
                className={`px-3 py-1.5 transition-colors ${
                  incomeSource === opt.value
                    ? 'bg-emerald-500 text-white font-semibold'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* EPF / SOCSO / EIS / PCB panel — only for personal salary income */}
      {globalLedger === 'personal' && incomeSource === 'salary' && valid.some(txn => txn.type === 'income') && (() => {
        const totalIncome = valid.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        const epf = calcEpfSocso(totalIncome)
        const pcb = calcPcb(totalIncome, isMarried)
        const netAfterAll = epf.netTakehome - pcb.monthlyPcb
        return (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-3">
            {/* Header + marital status toggle */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">🏦 EPF / SOCSO / EIS / PCB</p>
              <div className="flex rounded-lg border border-blue-300 overflow-hidden text-[10px]">
                {([
                  { v: false, label: '单身' },
                  { v: true,  label: '已婚' },
                ] as { v: boolean; label: string }[]).map(opt => (
                  <button key={String(opt.v)} onClick={() => setIsMarried(opt.v)}
                    className={`px-2.5 py-1 transition-colors ${isMarried === opt.v ? 'bg-blue-600 text-white font-semibold' : 'bg-transparent text-blue-600'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Breakdown table */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">月薪（税前）</span>
                  <span className="font-medium">RM {epf.grossWage.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EPF 雇员 (11%)</span>
                  <span className="font-medium text-blue-600">−RM {epf.epfEmployee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SOCSO (0.5%)</span>
                  <span className="font-medium text-blue-600">−RM {epf.socsoEmployee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EIS (0.2%)</span>
                  <span className="font-medium text-blue-600">−RM {epf.eisEmployee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PCB 月扣税</span>
                  <span className="font-medium text-orange-500">
                    {pcb.monthlyPcb > 0 ? `−RM ${pcb.monthlyPcb.toFixed(2)}` : 'RM 0'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-1.5">
                  <span className="font-semibold">到手工资</span>
                  <span className="font-bold text-emerald-600">RM {netAfterAll.toFixed(2)}</span>
                </div>
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>雇主 EPF (13%)</span>
                  <span>+RM {epf.epfEmployer.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>EPF 总计</span>
                  <span>RM {(epf.epfEmployee + epf.epfEmployer).toFixed(2)}</span>
                </div>
                <div className="border-t border-blue-200 pt-1.5 space-y-1">
                  <p className="text-muted-foreground font-medium">PCB 估算依据</p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>年收入</span>
                    <span>RM {pcb.annualGross.toLocaleString('en-MY')}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>减免合计</span>
                    <span>RM {(pcb.epfDeduction + pcb.personalRelief + pcb.spouseRelief).toLocaleString('en-MY')}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>应税收入</span>
                    <span>RM {pcb.chargeableIncome.toLocaleString('en-MY')}</span>
                  </div>
                  <div className="flex justify-between font-medium text-orange-500">
                    <span>年税额</span>
                    <span>RM {pcb.annualTax.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Individual toggles */}
            <div className="space-y-2 border-t border-blue-200 pt-2">
              {[
                {
                  label: '📈 自动添加 EPF 至投资组合',
                  sub: `RM ${epf.epfEmployee.toFixed(2)} 记入 KWSP-EPF 持仓`,
                  active: autoEpf,
                  toggle: () => setAutoEpf(v => !v),
                },
                {
                  label: '🛡️ 自动记录 SOCSO 扣款',
                  sub: `扣 RM ${epf.socsoEmployee.toFixed(2)}`,
                  active: autoSocso,
                  toggle: () => setAutoSocso(v => !v),
                },
                {
                  label: '📋 自动记录 EIS 扣款',
                  sub: `扣 RM ${epf.eisEmployee.toFixed(2)}`,
                  active: autoEis,
                  toggle: () => setAutoEis(v => !v),
                },
                {
                  label: '🏛️ 自动记录 PCB 月扣税',
                  sub: pcb.monthlyPcb > 0 ? `扣 RM ${pcb.monthlyPcb.toFixed(2)} → 记录为支出 (income_tax)` : '月薪未达扣税门槛',
                  active: autoPcb,
                  toggle: () => setAutoPcb(v => !v),
                  disabled: pcb.monthlyPcb === 0,
                },
              ].map(item => (
                <label key={item.label} className={`flex items-center justify-between cursor-pointer ${(item as { disabled?: boolean }).disabled ? 'opacity-40' : ''}`}>
                  <div>
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                  </div>
                  <button
                    onClick={item.toggle}
                    disabled={(item as { disabled?: boolean }).disabled}
                    className={`relative w-10 h-5 rounded-full transition-colors ${item.active ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.active ? 'translate-x-5' : ''}`} />
                  </button>
                </label>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Transaction cards */}
      <div className="space-y-2 max-h-[50dvh] overflow-y-auto pr-0.5">
        {valid.map((txn, i) => {
          const isExpanded = expandedIdx === i
          const acctName = resolvedAccountName(i)

          return (
            <Card key={i} className="bg-muted border-0 overflow-hidden">
              <CardContent className="p-0">
                {/* ── Collapsed row ── */}
                <div className="p-3 flex items-start gap-2">
                  <span className="text-xl leading-none mt-0.5 shrink-0">{getTxnIcon(txn)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {txn.merchant_name || txn.description || t.txn_unnamed}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getTxnLabel(txn, t.preview_transfer, lang)} • {acctName || 'Cash'}
                    </p>
                    <p className="text-xs text-muted-foreground">{txn.transaction_date}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      'text-sm font-semibold',
                      txn.type === 'income' ? 'text-emerald-600' : 'text-foreground'
                    )}>
                      {txn.type === 'income' ? '+' : '-'}RM {txn.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                      className="text-xs text-muted-foreground bg-background rounded-lg px-2 py-1 hover:bg-foreground/10"
                    >
                      {isExpanded ? t.preview_done : t.preview_edit}
                    </button>
                  </div>
                </div>

                {/* ── Expanded edit panel ── */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-3 bg-background/50">

                    {/* Type switcher */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['expense', 'income', 'transfer'] as const).map(tp => (
                        <button
                          key={tp}
                          onClick={() => update(i, {
                            type: tp,
                            expense_category: tp === 'expense' ? (txn.expense_category ?? 'other_expense') : null,
                            income_category: tp === 'income' ? (txn.income_category ?? 'other_income') : null,
                          })}
                          className={`py-1.5 text-xs rounded-lg border transition-colors ${
                            txn.type === tp
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-border hover:bg-muted'
                          }`}
                        >
                          {tp === 'expense' ? t.preview_type_expense : tp === 'income' ? t.preview_type_income : t.preview_type_transfer}
                        </button>
                      ))}
                    </div>

                    {/* Description + Amount */}
                    <div className="grid grid-cols-5 gap-2">
                      <Input
                        className="col-span-3 h-9 text-sm bg-background"
                        placeholder={t.txn_unnamed}
                        value={txn.merchant_name || txn.description || ''}
                        onChange={e => update(i, { merchant_name: e.target.value, description: e.target.value })}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        className="col-span-2 h-9 text-sm bg-background"
                        value={txn.amount}
                        onChange={e => update(i, { amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    {/* Date */}
                    <Input
                      type="date"
                      className="h-9 text-sm bg-background"
                      value={txn.transaction_date}
                      onChange={e => update(i, { transaction_date: e.target.value })}
                    />

                    {/* Account picker */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {txn.type === 'transfer' ? '从 (From)' : t.preview_account_label}
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {accounts.map(acct => (
                          <button
                            key={acct.id}
                            onClick={() => selectAccount(i, acct.name)}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                              txn.account_name === acct.name && !showCustomInput[i]
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-border hover:bg-muted'
                            }`}
                          >
                            <span>{accountEmoji(acct.account_type)}</span>
                            <span>{acct.name}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => selectCustom(i)}
                          className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                            showCustomInput[i]
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-dashed border-border hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          {t.preview_custom_account}
                        </button>
                      </div>

                      {/* Custom account input */}
                      {showCustomInput[i] && (
                        <div className="flex gap-2 mt-1">
                          <Input
                            autoFocus
                            className="h-8 text-sm flex-1 bg-background"
                            placeholder="e.g. Alliance Bank, Touch n Go"
                            value={customAccount[i] ?? ''}
                            onChange={e => setCustomAccount(prev => ({ ...prev, [i]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') commitCustom(i, customAccount[i] ?? '') }}
                          />
                          <button
                            onClick={() => commitCustom(i, customAccount[i] ?? '')}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white"
                          >
                            {t.preview_done}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* To Account picker — only for transfers */}
                    {txn.type === 'transfer' && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">到 (To)</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {accounts
                            .filter(acct => acct.name !== txn.account_name)
                            .map(acct => (
                              <button
                                key={acct.id}
                                onClick={() => update(i, { to_account_name: acct.name })}
                                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                                  txn.to_account_name === acct.name
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'border-border hover:bg-muted'
                                }`}
                              >
                                <span>{accountEmoji(acct.account_type)}</span>
                                <span>{acct.name}</span>
                              </button>
                            ))}
                        </div>
                        {!txn.to_account_name && (
                          <p className="text-[10px] text-amber-500">请选择目标户口</p>
                        )}
                      </div>
                    )}

                    {txn.is_tax_deductible && (
                      <p className="text-xs text-blue-500">{t.preview_tax_deductible}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button
        className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
        onClick={handleSave}
        disabled={saving || valid.length === 0}
      >
        {saving ? t.preview_saving : `💾 ${saveLabel}`}
      </Button>

      <Button variant="ghost" className="w-full" onClick={onDiscard} disabled={saving}>
        {t.preview_discard}
      </Button>
    </div>
  )
}
