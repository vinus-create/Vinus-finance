'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORY_MAP, INCOME_CATEGORY_MAP } from '@/lib/constants/categories'
import { useCustomCategories, type CustomCategory } from '@/lib/hooks/useCustomCategories'
import { cn } from '@/lib/utils'
import type { ParsedTransaction } from '@/lib/ai/parser'
import type { Account, LedgerType, ExpenseCategory, IncomeCategory } from '@/lib/types/app.types'
import type { IngestMeta, IngestSaveRequest, SaveTransactionRow } from '@/lib/types/ingest.types'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { getCategoryLabel } from '@/lib/utils/category-i18n'
import type { LangCode } from '@/lib/i18n'
import SuccessCelebration from '@/components/ui/SuccessCelebration'
import type { DetectedAccount } from './PDFParser'

interface Props {
  transactions: ParsedTransaction[]
  detectedAccount?: DetectedAccount | null
  ingestMeta?: IngestMeta | null
  onDiscard: () => void
  onSaved: () => void
}

type SkippedRow = ParsedTransaction & { certain: boolean }

/** Category slug on a row, or null for transfers / uncategorized. */
function catSlug(t: ParsedTransaction): string | null {
  if (t.type === 'expense') return t.expense_category ?? null
  if (t.type === 'income') return t.income_category ?? null
  return null
}

function builtinMeta(slug: string, type: ParsedTransaction['type']) {
  return type === 'expense'
    ? EXPENSE_CATEGORY_MAP[slug as ExpenseCategory]
    : INCOME_CATEGORY_MAP[slug as IncomeCategory]
}

function getTxnIcon(t: ParsedTransaction, custom: CustomCategory[]): string {
  const slug = catSlug(t)
  if (!slug) return '🔄'
  return builtinMeta(slug, t.type)?.icon
    ?? custom.find(c => c.slug === slug)?.icon
    ?? (t.type === 'income' ? '💰' : '💸')
}

function getTxnLabel(txn: ParsedTransaction, fallback: string, lang: LangCode, custom: CustomCategory[]): string {
  const slug = catSlug(txn)
  if (!slug) return fallback
  if (builtinMeta(slug, txn.type)) return getCategoryLabel(slug, txn.type, lang)
  return custom.find(c => c.slug === slug)?.label ?? slug
}

function accountEmoji(type: Account['account_type']): string {
  const map: Record<string, string> = { bank: '🏦', ewallet: '💳', investment: '📈', cash: '💵', credit_card: '💳', other: '🏧' }
  return map[type] ?? '🏦'
}

export default function TransactionPreview({ transactions, detectedAccount, ingestMeta, onDiscard, onSaved }: Props) {
  // Rows start on the detected/candidate account; from then on the row value is
  // the single source of truth — save() must never override a user's choice.
  const [edited, setEdited] = useState<SaveTransactionRow[]>(() => {
    const defaultAccount = detectedAccount?.name ?? ingestMeta?.candidateAccount?.suggested_name ?? null
    return transactions.map(t => ({
      ...t,
      account_name: defaultAccount ?? t.account_name,
      to_account_name: t.to_account_name ?? null,
    }))
  })
  const [skipped, setSkipped] = useState<SkippedRow[]>(() => [
    ...(ingestMeta?.suspected ?? []).map(t => ({ ...t, certain: false })),
    ...(ingestMeta?.duplicates ?? []).map(t => ({ ...t, certain: true })),
  ])
  const [createCandidate, setCreateCandidate] = useState(true)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [customAccount, setCustomAccount] = useState<Record<number, string>>({})
  const [showCustomInput, setShowCustomInput] = useState<Record<number, boolean>>({})
  const [accounts, setAccounts] = useState<Account[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  // Rows whose category the user set by hand here — remembered on save so the
  // same merchant auto-categorizes on the next import.
  const [catTouched, setCatTouched] = useState<Set<number>>(new Set())
  const [globalLedger, setGlobalLedger] = useState<LedgerType>(() =>
    transactions.some(tx => tx.ledger === 'business') ? 'business' : 'personal'
  )
  const [globalAccount, setGlobalAccount] = useState<string>(detectedAccount?.name ?? '')
  const { t, lang } = useLang()
  const customCats = useCustomCategories()

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
    if (data && data.length > 0) setAccounts(data as Account[])
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  function update(idx: number, patch: Partial<ParsedTransaction>) {
    setEdited(prev => prev.map((txn, i) => i === idx ? { ...txn, ...patch } : txn))
  }

  /** Drop a row from this import entirely (it is simply never saved). */
  function removeRow(idx: number) {
    setEdited(prev => prev.filter((_, i) => i !== idx))
    setExpandedIdx(null)
  }

  /** Built-in (localized) + user's custom categories for a row's type. */
  function catOptionsFor(type: ParsedTransaction['type']) {
    if (type === 'transfer') return []
    const builtins = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
    return [
      ...builtins.map(c => ({ value: c.value as string, icon: c.icon, label: getCategoryLabel(c.value, type, lang) })),
      ...customCats.filter(c => c.kind === type).map(c => ({ value: c.slug, icon: c.icon, label: c.label })),
    ]
  }

  function applyGlobalAccount(name: string) {
    setGlobalAccount(name)
    setEdited(prev => prev.map(txn => ({ ...txn, account_name: name })))
    setShowCustomInput({})
  }

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

  function sanitizeDate(dateStr: string): string {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return dateStr
    const [, year, month, day] = m
    if (parseInt(month) > 12 && parseInt(day) <= 12) return `${year}-${day}-${month}`
    if (parseInt(month) > 12) return new Date().toISOString().slice(0, 10)
    return dateStr
  }

  /** Pull a default-skipped (suspected duplicate) row back into the import list */
  function includeSkipped(idx: number) {
    const row = skipped[idx]
    if (!row) return
    setSkipped(prev => prev.filter((_, i) => i !== idx))
    setEdited(prev => [...prev, { ...row, is_duplicate_override: true }])
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const candidate = (!detectedAccount && createCandidate) ? (ingestMeta?.candidateAccount ?? null) : null

      const rows: SaveTransactionRow[] = edited
        .filter(txn => txn.amount > 0)
        .map(txn => ({
          ...txn,
          transaction_date: sanitizeDate(txn.transaction_date),
          account_name: txn.account_name || candidate?.suggested_name || 'Cash',
          to_account_name: txn.type === 'transfer' ? (txn.to_account_name ?? null) : null,
          ledger: globalLedger,
        }))

      // Closing balance belongs to whichever account the user says the statement is —
      // the global chip choice wins over the auto-detected match.
      const statementSync = detectedAccount
        ? { account_name: globalAccount || detectedAccount.name, closing_balance: detectedAccount.closing_balance, statement_date: detectedAccount.statement_date ?? null }
        : candidate
        ? { account_name: candidate.suggested_name, closing_balance: candidate.closing_balance, statement_date: candidate.statement_date }
        : null

      const payload: IngestSaveRequest = {
        batchId: ingestMeta?.batchId ?? null,
        transactions: rows,
        createAccount: candidate,
        statementSync,
      }

      const res = await fetch('/api/ingest/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? t.preview_error_save)

      // Remember hand-picked categories so the next import auto-applies them.
      // Fire-and-forget: a failed memory write must never block the save.
      if (catTouched.size > 0) {
        void (async () => {
          try {
            const { rememberUserChoice } = await import('@/lib/utils/merchant-memory-client')
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const seen = new Set<string>()
            for (const idx of catTouched) {
              const row = edited[idx]
              const merchant = row?.merchant_name?.trim()
              if (!row || row.type !== 'expense' || !merchant || !row.expense_category) continue
              const key = merchant.toLowerCase()
              if (seen.has(key)) continue
              seen.add(key)
              await rememberUserChoice(supabase, user.id, merchant, row.expense_category)
            }
          } catch { /* memory is best-effort */ }
        })()
      }

      // Balances are applied by the DB trigger; closing balance synced server-side
      setShowCelebration(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.preview_error_save)
    } finally {
      setSaving(false)
    }
  }

  // Keep each row's index into `edited` — update/remove/account helpers all address
  // that array, so filtering without it silently edits the wrong row.
  const valid = edited
    .map((txn, origIdx) => ({ txn, origIdx }))
    .filter(({ txn }) => txn.amount > 0)
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
              {detectedAccount.name}
              {detectedAccount.last4 && ` ••••${detectedAccount.last4}`}
              {detectedAccount.closing_balance !== null
                ? ` · Balance: RM ${detectedAccount.closing_balance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
                : ''}
            </p>
          </div>
        </div>
      )}

      {/* Account auto-discovery: offer to create the statement's account */}
      {!detectedAccount && ingestMeta?.candidateAccount && (
        <button
          onClick={() => setCreateCandidate(v => !v)}
          className={`w-full flex items-center gap-2 p-3 rounded-xl text-xs text-left transition-colors ${
            createCandidate
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <span className="text-base">{createCandidate ? '✅' : '⬜'}</span>
          <div>
            <p className="font-semibold">✨ 自动创建户口：{ingestMeta.candidateAccount.suggested_name}</p>
            <p className="opacity-80">
              {ingestMeta.candidateAccount.last4 && `••••${ingestMeta.candidateAccount.last4} · `}
              {ingestMeta.candidateAccount.closing_balance !== null
                ? `结余 RM ${ingestMeta.candidateAccount.closing_balance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
                : '从对账单检测到新户口'}
            </p>
          </div>
        </button>
      )}

      {/* Personal / Business ledger toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground font-medium">{t.ledger_label}:</span>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['personal', 'business'] as LedgerType[]).map(l => (
            <button key={l} onClick={() => setGlobalLedger(l)}
              className={`px-3 py-1.5 transition-colors ${globalLedger === l ? 'bg-emerald-500 text-white font-semibold' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              {l === 'personal' ? `👤 ${t.ledger_personal}` : `🏪 ${t.ledger_business}`}
            </button>
          ))}
        </div>
      </div>

      {/* Global account picker */}
      {accounts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t.preview_account_label}</p>
          <div className="flex gap-1.5 flex-wrap">
            {accounts.map(acct => (
              <button key={acct.id} onClick={() => applyGlobalAccount(acct.name)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                  globalAccount === acct.name
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-border hover:bg-muted'}`}>
                <span>{accountEmoji(acct.account_type)}</span>
                <span>{acct.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{valid.length} {t.preview_detected}</p>

      {/* Transaction cards */}
      <div className="space-y-2 max-h-[50dvh] overflow-y-auto pr-0.5">
        {valid.map(({ txn, origIdx }) => {
          const isExpanded = expandedIdx === origIdx
          const acctName = resolvedAccountName(origIdx)
          const catOptions = catOptionsFor(txn.type)
          const currentCat = catSlug(txn)

          return (
            <Card key={origIdx} className="bg-muted border-0 overflow-hidden">
              <CardContent className="p-0">
                <div className="p-3 flex items-start gap-2">
                  <span className="text-xl leading-none mt-0.5 shrink-0">{getTxnIcon(txn, customCats)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {txn.confidence < 0.6 && <span title="AI 解析置信度低，请核对" className="mr-1">⚠️</span>}
                      {txn.is_duplicate_override && <span title="疑似重复 — 已强制导入" className="mr-1 text-amber-500">🔁</span>}
                      {txn.merchant_name || txn.description || t.txn_unnamed}
                    </p>
                    <p className="text-xs text-muted-foreground">{getTxnLabel(txn, t.preview_transfer, lang, customCats)} • {acctName || 'Cash'}</p>
                    <p className="text-xs text-muted-foreground">{txn.transaction_date}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('text-sm font-semibold', txn.type === 'income' ? 'text-emerald-600' : 'text-foreground')}>
                      {txn.type === 'income' ? '+' : '-'}RM {txn.amount.toFixed(2)}
                    </span>
                    <button onClick={() => setExpandedIdx(isExpanded ? null : origIdx)}
                      className="text-xs text-muted-foreground bg-background rounded-lg px-2 py-1 hover:bg-foreground/10">
                      {isExpanded ? t.preview_done : t.preview_edit}
                    </button>
                    <button onClick={() => removeRow(origIdx)} title="不导入这笔"
                      className="text-sm text-muted-foreground hover:text-red-500 px-1 py-1 leading-none">
                      🗑️
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-3 bg-background/50">
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['expense', 'income', 'transfer'] as const).map(tp => (
                        <button key={tp}
                          onClick={() => update(origIdx, {
                            type: tp,
                            expense_category: tp === 'expense' ? (txn.expense_category ?? 'other_expense') : null,
                            income_category: tp === 'income' ? (txn.income_category ?? 'other_income') : null,
                          })}
                          className={`py-1.5 text-xs rounded-lg border transition-colors ${txn.type === tp ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:bg-muted'}`}>
                          {tp === 'expense' ? t.preview_type_expense : tp === 'income' ? t.preview_type_income : t.preview_type_transfer}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      <Input className="col-span-3 h-9 text-sm bg-background" placeholder={t.txn_unnamed}
                        value={txn.merchant_name || txn.description || ''}
                        onChange={e => update(origIdx, { merchant_name: e.target.value, description: e.target.value })} />
                      <Input type="number" step="0.01" className="col-span-2 h-9 text-sm bg-background"
                        value={txn.amount} onChange={e => update(origIdx, { amount: Math.round((parseFloat(e.target.value) || 0) * 100) / 100 })} />
                    </div>

                    <Input type="date" className="h-9 text-sm bg-background" value={txn.transaction_date}
                      onChange={e => update(origIdx, { transaction_date: e.target.value })} />

                    {/* Category picker — built-in (localized) + custom, per row type */}
                    {catOptions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {t.edit_txn_category_label}
                        </p>
                        <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto p-1 bg-muted/30 rounded-lg">
                          {catOptions.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                update(origIdx, txn.type === 'expense'
                                  ? { expense_category: opt.value as ExpenseCategory, income_category: null }
                                  : { income_category: opt.value as IncomeCategory, expense_category: null })
                                setCatTouched(prev => new Set(prev).add(origIdx))
                              }}
                              className={cn(
                                'flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-[10px] transition-colors',
                                currentCat === opt.value ? 'bg-emerald-500 text-white' : 'bg-background hover:bg-muted'
                              )}
                            >
                              <span className="text-xl">{opt.icon}</span>
                              <span className="leading-tight text-center line-clamp-2">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {txn.type === 'transfer' ? '从 (From)' : t.preview_account_label}
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {accounts.map(acct => (
                          <button key={acct.id} onClick={() => selectAccount(origIdx, acct.name)}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                              txn.account_name === acct.name && !showCustomInput[origIdx]
                                ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:bg-muted'}`}>
                            <span>{accountEmoji(acct.account_type)}</span>
                            <span>{acct.name}</span>
                          </button>
                        ))}
                        <button onClick={() => selectCustom(origIdx)}
                          className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                            showCustomInput[origIdx] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-dashed border-border hover:bg-muted text-muted-foreground'}`}>
                          {t.preview_custom_account}
                        </button>
                      </div>
                      {showCustomInput[origIdx] && (
                        <div className="flex gap-2 mt-1">
                          <Input autoFocus className="h-8 text-sm flex-1 bg-background" placeholder="e.g. Alliance Bank"
                            value={customAccount[origIdx] ?? ''} onChange={e => setCustomAccount(prev => ({ ...prev, [origIdx]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') commitCustom(origIdx, customAccount[origIdx] ?? '') }} />
                          <button onClick={() => commitCustom(origIdx, customAccount[origIdx] ?? '')}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white">{t.preview_done}</button>
                        </div>
                      )}
                    </div>

                    {txn.type === 'transfer' && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">到 (To)</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {accounts.filter(acct => acct.name !== txn.account_name).map(acct => (
                            <button key={acct.id} onClick={() => update(origIdx, { to_account_name: acct.name })}
                              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                                txn.to_account_name === acct.name ? 'bg-blue-500 border-blue-500 text-white' : 'border-border hover:bg-muted'}`}>
                              <span>{accountEmoji(acct.account_type)}</span>
                              <span>{acct.name}</span>
                            </button>
                          ))}
                        </div>
                        {!txn.to_account_name && <p className="text-[10px] text-amber-500">请选择目标户口</p>}
                      </div>
                    )}

                    {txn.is_tax_deductible && <p className="text-xs text-blue-500">{t.preview_tax_deductible}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Skipped duplicates — default not imported, tap to override */}
      {skipped.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-amber-600">
            ⚠️ {skipped.length} 笔疑似重复（已自动跳过 — 点击可强制导入）
          </p>
          <div className="space-y-1.5 max-h-[22dvh] overflow-y-auto pr-0.5">
            {skipped.map((txn, i) => (
              <button key={i} onClick={() => includeSkipped(i)}
                className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-muted/60 opacity-60 hover:opacity-100 text-left transition-opacity">
                <span className="text-base shrink-0">{txn.certain ? '🔒' : '🔁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate line-through">{txn.merchant_name || txn.description || t.txn_unnamed}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {txn.transaction_date} · {txn.certain ? `参考号相同 ${txn.reference_number ?? ''}` : '日期/金额/户口相同'}
                  </p>
                </div>
                <span className="text-xs font-semibold shrink-0">RM {txn.amount.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
        onClick={handleSave} disabled={saving || valid.length === 0}>
        {saving ? t.preview_saving : `💾 ${saveLabel}`}
      </Button>

      <Button variant="ghost" className="w-full" onClick={onDiscard} disabled={saving}>
        {t.preview_discard}
      </Button>
    </div>
  )
}
