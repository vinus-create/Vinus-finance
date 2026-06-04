'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import type { StockHolding, StockTrade, StockWatchlist } from '@/lib/types/app.types'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { useFab } from '@/lib/contexts/FabContext'
import HoldingCard from './HoldingCard'
import PortfolioChart from './PortfolioChart'
import AddHoldingSheet from './AddHoldingSheet'
import WatchlistCard from './WatchlistCard'
import AddWatchlistSheet from './AddWatchlistSheet'
import EmptyState from '@/components/ui/EmptyState'

export interface PriceData {
  price: number
  prevClose: number
  name: string
  currency: string
}

interface Props {
  holdings: StockHolding[]
  trades: StockTrade[]
  watchlist: StockWatchlist[]
}

type Tab = 'portfolio' | 'watchlist' | 'history'

export default function StocksClient({ holdings, trades, watchlist }: Props) {
  const { t } = useLang()
  const { setFabAction } = useFab()
  const [tab, setTab] = useState<Tab>('portfolio')
  const [prices, setPrices] = useState<Record<string, PriceData | null>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [addHoldingOpen, setAddHoldingOpen] = useState(false)
  const [editHolding, setEditHolding] = useState<StockHolding | undefined>()
  const [addWatchlistOpen, setAddWatchlistOpen] = useState(false)

  // Register FAB action based on active tab
  useEffect(() => {
    if (tab === 'history') {
      setFabAction(null)
      return
    }
    if (tab === 'portfolio') {
      setFabAction(() => () => { setEditHolding(undefined); setAddHoldingOpen(true) })
    } else {
      setFabAction(() => () => setAddWatchlistOpen(true))
    }
    return () => setFabAction(null)
  }, [tab, setFabAction])

  const allTickers = Array.from(new Set([
    ...holdings.map(h => h.ticker),
    ...watchlist.map(w => w.ticker),
  ]))

  async function fetchPrices() {
    if (allTickers.length === 0) return
    setLoadingPrices(true)
    try {
      const res = await fetch(`/api/stocks/price?tickers=${allTickers.join(',')}`)
      const data = await res.json()
      setPrices(data)
    } catch {
      // silently ignore — price is optional
    } finally {
      setLoadingPrices(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPrices() }, [])

  // Portfolio summary
  const totalCost = holdings.reduce((s, h) => s + h.shares * h.avg_cost_price, 0)
  const totalValue = holdings.reduce((s, h) => {
    const p = prices[h.ticker]
    return s + h.shares * (p?.price ?? h.avg_cost_price)
  }, 0)
  const totalGain = totalValue - totalCost
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  const tabs: { key: Tab; label: string }[] = [
    { key: 'portfolio', label: t.stocks_portfolio_tab },
    { key: 'watchlist', label: t.stocks_watchlist_tab },
    { key: 'history',   label: t.stocks_history_tab },
  ]

  return (
    <div className="pb-28">
      {/* Summary bar */}
      {holdings.length > 0 && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs text-muted-foreground">{t.stocks_total_value}</p>
              <p className="text-2xl font-bold">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <button
              onClick={fetchPrices}
              disabled={loadingPrices}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label={t.stocks_refresh_prices}
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loadingPrices ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground">{t.stocks_total_cost}</p>
              <p className="text-xs font-semibold">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{t.stocks_total_gain}</p>
              <p className={`text-xs font-semibold ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {totalGain >= 0 ? '+' : ''}${totalGain.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{t.stocks_return}</p>
              <p className={`text-xs font-semibold ${totalGainPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mx-4 mt-4 flex gap-1.5">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs rounded-xl font-medium transition-colors ${
              tab === key
                ? 'bg-emerald-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 mt-4 space-y-3">

        {/* ── Portfolio ── */}
        {tab === 'portfolio' && (
          holdings.length === 0
            ? <EmptyState emoji="📈" title={t.stocks_empty} body={t.stocks_empty_hint} />
            : <>
                <PortfolioChart holdings={holdings} prices={prices} />
                {holdings.map(h => (
                  <HoldingCard
                    key={h.id}
                    holding={h}
                    priceData={prices[h.ticker] ?? null}
                    onEdit={() => { setEditHolding(h); setAddHoldingOpen(true) }}
                  />
                ))}
              </>
        )}

        {/* ── Watchlist ── */}
        {tab === 'watchlist' && (
          watchlist.length === 0
            ? <EmptyState emoji="👀" title={t.stocks_watchlist_empty} body={t.stocks_watchlist_empty_hint} />
            : watchlist.map(w => (
                <WatchlistCard key={w.id} item={w} priceData={prices[w.ticker] ?? null} />
              ))
        )}

        {/* ── History ── */}
        {tab === 'history' && (
          trades.length === 0
            ? <EmptyState emoji="📋" title={t.stocks_history_empty} body={t.stocks_empty_hint} />
            : <div className="space-y-2">
                {trades.map(trade => (
                  <div key={trade.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        trade.trade_type === 'buy'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      }`}>
                        {trade.trade_type === 'buy' ? t.stocks_buy : t.stocks_sell}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{trade.ticker}</p>
                        <p className="text-xs text-muted-foreground">
                          {trade.shares} {t.stocks_shares} @ ${trade.price_per_share.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${trade.total_amount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{trade.trade_date}</p>
                    </div>
                  </div>
                ))}
              </div>
        )}
      </div>

      {/* Sheets */}
      <AddHoldingSheet
        open={addHoldingOpen}
        onOpenChange={(o) => { setAddHoldingOpen(o); if (!o) setEditHolding(undefined) }}
        holding={editHolding}
      />
      <AddWatchlistSheet open={addWatchlistOpen} onOpenChange={setAddWatchlistOpen} />
    </div>
  )
}
