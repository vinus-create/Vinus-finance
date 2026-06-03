'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { StockHolding } from '@/lib/types/app.types'
import type { PriceData } from './StocksClient'

// ─── EPF Annual Dividend Helper ───────────────────────────────

function EpfDividendButton({ holding }: { holding: StockHolding }) {
  const router = useRouter()
  const [showInput, setShowInput] = useState(false)
  const [rate, setRate] = useState('5.50')
  const [applying, setApplying] = useState(false)

  async function applyDividend() {
    const r = parseFloat(rate)
    if (!r || r <= 0 || r > 20) { toast.error('红利率需在 0–20% 之间'); return }
    setApplying(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')
      const dividendAmt = parseFloat((holding.shares * r / 100).toFixed(2))
      const today = new Date().toISOString().slice(0, 10)

      // Update EPF balance
      await supabase.from('stock_holdings').update({
        shares: holding.shares + dividendAmt,
        updated_at: new Date().toISOString(),
      }).eq('id', holding.id)

      // Record dividend as income transaction
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'income', amount: dividendAmt, currency: 'MYR',
        income_category: 'dividend',
        merchant_name: 'KWSP/EPF',
        description: `EPF 年度红利 ${r}% (${new Date().getFullYear()})`,
        account_name: 'EPF (KWSP)', transaction_date: today,
        ledger: 'personal', is_tax_deductible: false,
      })

      toast.success(`EPF 红利 RM ${dividendAmt.toFixed(2)} 已记录`)
      setShowInput(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '失败')
    } finally {
      setApplying(false)
    }
  }

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="w-full text-xs py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
      >
        🎁 申请年度红利
      </button>
    )
  }

  return (
    <div className="flex gap-2 items-center">
      <span className="text-xs text-muted-foreground shrink-0">红利率 %</span>
      <input
        type="number"
        step="0.01"
        value={rate}
        onChange={e => setRate(e.target.value)}
        className="h-8 flex-1 text-sm border border-border rounded-lg px-2 bg-background"
        placeholder="5.50"
        autoFocus
      />
      <span className="text-xs text-muted-foreground shrink-0">
        = RM {(holding.shares * (parseFloat(rate) || 0) / 100).toFixed(2)}
      </span>
      <button onClick={applyDividend} disabled={applying}
        className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white shrink-0">
        {applying ? '...' : '确认'}
      </button>
      <button onClick={() => setShowInput(false)}
        className="text-xs px-2 py-1.5 rounded-lg border border-border shrink-0">✕</button>
    </div>
  )
}

interface Props {
  holding: StockHolding
  priceData: PriceData | null
  onEdit: () => void
}

export default function HoldingCard({ holding, priceData, onEdit }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isGoldMyrGram = holding.ticker === 'GOLD-MYR-GRAM'
  const currentPrice = priceData?.price ?? holding.avg_cost_price
  const marketValue = holding.shares * currentPrice
  const costBasis = holding.shares * holding.avg_cost_price
  const unrealizedPnl = marketValue - costBasis
  const unrealizedPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0
  const dayChange = priceData ? priceData.price - priceData.prevClose : 0
  const dayChangePct = priceData && priceData.prevClose > 0 ? (dayChange / priceData.prevClose) * 100 : 0

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('stock_holdings')
        .update({ is_active: false })
        .eq('id', holding.id)
      if (error) throw new Error(error.message)
      toast.success(holding.ticker)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const ASSET_META: Record<string, { emoji: string; label: string; unitLabel: string }> = {
    stock: { emoji: '📈', label: '股票', unitLabel: '股' },
    etf: { emoji: '🔵', label: 'ETF', unitLabel: '单位' },
    gold: { emoji: '🟡', label: '黄金', unitLabel: 'g' },
    crypto: { emoji: '₿', label: '加密货币', unitLabel: '个' },
    mutual_fund: { emoji: '📊', label: '基金', unitLabel: '单位' },
    other: { emoji: '💼', label: '其他', unitLabel: '单位' },
  }
  const assetMeta = ASSET_META[holding.asset_type ?? 'stock'] ?? ASSET_META['stock']!
  const currSymbol = holding.currency === 'MYR' ? 'RM' : holding.currency === 'SGD' ? 'S$' : holding.currency === 'HKD' ? 'HK$' : '$'

  return (
    <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{assetMeta.emoji}</span>
            <p className="font-bold text-base">{holding.ticker}</p>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {assetMeta.label}
            </span>
            {holding.exchange && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {holding.exchange}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {priceData?.name ?? holding.company_name ?? holding.ticker}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold">
            {currSymbol}{currentPrice.toFixed(holding.asset_type === 'crypto' ? 4 : 2)}
            {isGoldMyrGram && <span className="text-xs font-normal text-muted-foreground">/g</span>}
          </p>
          {priceData && holding.asset_type !== 'mutual_fund' && (
            <p className={`text-xs ${dayChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)} ({dayChangePct.toFixed(2)}%)
            </p>
          )}
          {holding.asset_type === 'mutual_fund' && (
            <p className="text-[10px] text-muted-foreground">手动 NAV</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">
            {holding.ticker === 'KWSP-EPF' ? '累积 (RM)' : assetMeta.unitLabel}
          </p>
          <p className="text-xs font-semibold">
            {holding.ticker === 'KWSP-EPF' ? `RM ${Number(holding.shares).toFixed(2)}` : holding.shares}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{t.stocks_avg_cost}</p>
          <p className="text-xs font-semibold">{currSymbol}{holding.avg_cost_price.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{t.stocks_market_value}</p>
          <p className="text-xs font-semibold">{currSymbol}{marketValue.toFixed(2)}</p>
        </div>
      </div>

      {/* P&L */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
        unrealizedPnl >= 0
          ? 'bg-emerald-50 dark:bg-emerald-950/30'
          : 'bg-red-50 dark:bg-red-950/30'
      }`}>
        <p className="text-xs text-muted-foreground">{t.stocks_unrealized_pnl}</p>
        <p className={`text-xs font-bold ${unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {unrealizedPnl >= 0 ? '+' : ''}{currSymbol}{unrealizedPnl.toFixed(2)}{' '}
          ({unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%)
        </p>
      </div>

      {/* EPF Annual Dividend button — only for KWSP-EPF */}
      {holding.ticker === 'KWSP-EPF' && (
        <div className="mb-2">
          <EpfDividendButton holding={holding} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 text-xs py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          ✏️ {t.loan_edit_btn}
        </button>
        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 text-xs py-1.5 rounded-lg bg-red-500 text-white"
            >
              ⚠️ {t.confirm}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs py-1.5 px-3 rounded-lg border border-border"
            >
              {t.cancel}
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex-1 text-xs py-1.5 rounded-lg border border-border text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            🗑️ {t.delete}
          </button>
        )}
      </div>
    </div>
  )
}
