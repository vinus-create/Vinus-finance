'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { StockWatchlist } from '@/lib/types/app.types'
import type { PriceData } from './StocksClient'

interface Props {
  item: StockWatchlist
  priceData: PriceData | null
}

export default function WatchlistCard({ item, priceData }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const dayChange = priceData ? priceData.price - priceData.prevClose : null
  const dayChangePct = priceData && priceData.prevClose > 0
    ? ((priceData.price - priceData.prevClose) / priceData.prevClose) * 100
    : null

  const nearTarget = item.target_price && priceData
    ? Math.abs(priceData.price - item.target_price) / item.target_price < 0.05
    : false

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('stock_watchlist').delete().eq('id', item.id)
      if (error) throw new Error(error.message)
      toast.success(item.ticker)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-card border border-border">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold">{item.ticker}</p>
            {item.exchange && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {item.exchange}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {priceData?.name ?? item.company_name ?? item.ticker}
          </p>
          {item.target_price && (
            <p className={`text-xs mt-0.5 ${nearTarget ? 'text-orange-500 font-semibold' : 'text-blue-500'}`}>
              {t.stocks_target_price}: ${item.target_price}
              {nearTarget && ' ⚡'}
            </p>
          )}
        </div>

        <div className="text-right">
          {priceData ? (
            <>
              <p className="text-base font-bold">${priceData.price.toFixed(2)}</p>
              {dayChange !== null && dayChangePct !== null && (
                <p className={`text-xs ${dayChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)} ({dayChangePct.toFixed(2)}%)
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t.stocks_price_unavailable}</p>
          )}
        </div>
      </div>

      {/* Delete */}
      <div className="flex gap-2 mt-3">
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
