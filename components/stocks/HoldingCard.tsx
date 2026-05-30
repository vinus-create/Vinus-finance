'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { StockHolding } from '@/lib/types/app.types'
import type { PriceData } from './StocksClient'

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

  return (
    <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-base">{holding.ticker}</p>
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
          <p className="text-base font-bold">${currentPrice.toFixed(2)}</p>
          {priceData && (
            <p className={`text-xs ${dayChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)} ({dayChangePct.toFixed(2)}%)
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">{t.stocks_shares}</p>
          <p className="text-xs font-semibold">{holding.shares}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{t.stocks_avg_cost}</p>
          <p className="text-xs font-semibold">${holding.avg_cost_price.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{t.stocks_market_value}</p>
          <p className="text-xs font-semibold">${marketValue.toFixed(2)}</p>
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
          {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}{' '}
          ({unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%)
        </p>
      </div>

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
