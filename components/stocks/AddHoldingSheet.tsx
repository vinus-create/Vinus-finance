'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { StockHolding, AssetType } from '@/lib/types/app.types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  holding?: StockHolding
}

const ASSET_TYPES: { type: AssetType; emoji: string; label: string; unitLabel: string; tickerHint: string; currencyDefault: string; presets?: { ticker: string; name: string }[] }[] = [
  {
    type: 'stock', emoji: '📈', label: '股票', unitLabel: '股数',
    tickerHint: 'AAPL / 1155.KL / 700.HK',
    currencyDefault: 'USD',
    presets: [
      { ticker: '1155.KL', name: 'Maybank' },
      { ticker: '1295.KL', name: 'Public Bank' },
      { ticker: 'AAPL', name: 'Apple' },
      { ticker: 'NVDA', name: 'Nvidia' },
    ],
  },
  {
    type: 'etf', emoji: '🔵', label: 'ETF', unitLabel: '单位',
    tickerHint: 'QQQ / SPY / 0820EA.KL',
    currencyDefault: 'USD',
    presets: [
      { ticker: 'SPY', name: 'S&P 500 ETF' },
      { ticker: 'QQQ', name: 'Nasdaq ETF' },
      { ticker: 'GLD', name: 'Gold ETF' },
      { ticker: '0820EA.KL', name: 'MyETF Dow Jones' },
    ],
  },
  {
    type: 'gold', emoji: '🟡', label: '黄金', unitLabel: '克 (g)',
    tickerHint: 'GOLD-MYR-GRAM（RM/克）或 GC=F（USD/oz）',
    currencyDefault: 'MYR',
    presets: [
      { ticker: 'GOLD-MYR-GRAM', name: '黄金 RM/克（实时）' },
      { ticker: 'GC=F', name: 'Gold Futures USD/oz' },
      { ticker: 'XAUUSD=X', name: 'XAU/USD Spot' },
      { ticker: 'GLD', name: 'SPDR Gold ETF' },
    ],
  },
  {
    type: 'crypto', emoji: '₿', label: '加密货币', unitLabel: '个',
    tickerHint: 'BTC-USD / ETH-USD / BNB-USD',
    currencyDefault: 'USD',
    presets: [
      { ticker: 'BTC-USD', name: 'Bitcoin' },
      { ticker: 'ETH-USD', name: 'Ethereum' },
      { ticker: 'BNB-USD', name: 'BNB' },
      { ticker: 'XRP-USD', name: 'XRP' },
    ],
  },
  {
    type: 'mutual_fund', emoji: '📊', label: '基金 / ASB', unitLabel: '单位',
    tickerHint: '基金名称（手动 NAV）',
    currencyDefault: 'MYR',
    presets: [
      { ticker: 'ASB', name: 'Amanah Saham Bumiputera' },
      { ticker: 'ASB2', name: 'ASB 2 Wawasan' },
      { ticker: 'ASNB', name: 'ASNB 金边基金' },
      { ticker: 'PB-GROWTH', name: 'Public Mutual Growth' },
    ],
  },
  {
    type: 'other', emoji: '💼', label: '其他', unitLabel: '单位',
    tickerHint: '自定义名称',
    currencyDefault: 'MYR',
  },
]

const CURRENCIES = ['MYR', 'USD', 'SGD', 'HKD']

function blank(assetType: AssetType = 'stock') {
  const meta = ASSET_TYPES.find(a => a.type === assetType)!
  return { assetType, ticker: '', company_name: '', exchange: '', shares: '', avg_cost_price: '', currency: meta.currencyDefault, notes: '' }
}

function toForm(h: StockHolding) {
  return {
    assetType: (h.asset_type ?? 'stock') as AssetType,
    ticker: h.ticker,
    company_name: h.company_name ?? '',
    exchange: h.exchange ?? '',
    shares: String(h.shares),
    avg_cost_price: String(h.avg_cost_price),
    currency: h.currency,
    notes: h.notes ?? '',
  }
}

export default function AddHoldingSheet({ open, onOpenChange, holding }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const isEdit = !!holding
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(holding ? toForm(holding) : blank())

  useEffect(() => {
    if (open) setForm(holding ? toForm(holding) : blank())
  }, [open, holding])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function selectAssetType(type: AssetType) {
    const meta = ASSET_TYPES.find(a => a.type === type)!
    setForm(f => ({ ...f, assetType: type, currency: meta.currencyDefault, ticker: '', company_name: '' }))
  }

  function selectPreset(ticker: string, name: string) {
    setForm(f => ({ ...f, ticker, company_name: name }))
  }

  const meta = ASSET_TYPES.find(a => a.type === form.assetType) ?? ASSET_TYPES[0]!
  const shares = parseFloat(form.shares) || 0
  const avgCost = parseFloat(form.avg_cost_price) || 0
  const totalCost = shares * avgCost
  const isMutualFund = form.assetType === 'mutual_fund'

  async function handleSave() {
    if (!form.ticker.trim()) { setError('请填写名称/代码'); return }
    if (!shares || shares <= 0) { setError(t.form_err_shares); return }
    if (!avgCost || avgCost <= 0) { setError(t.form_err_cost); return }

    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)

      const payload = {
        ticker: form.ticker.trim().toUpperCase(),
        company_name: form.company_name.trim() || null,
        exchange: form.exchange.trim() || null,
        asset_type: form.assetType,
        shares,
        avg_cost_price: avgCost,
        currency: form.currency,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (isEdit && holding) {
        const { error: e } = await supabase.from('stock_holdings').update(payload).eq('id', holding.id)
        if (e) throw new Error(e.message)
      } else {
        const { error: e } = await supabase.from('stock_holdings').insert({ ...payload, user_id: user.id, is_active: true })
        if (e) throw new Error(e.message)
      }

      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92dvh] overflow-y-auto">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{isEdit ? '编辑持仓' : '添加投资'}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 mt-3 space-y-4">
          {/* Asset type selector */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">资产类型</Label>
              <div className="grid grid-cols-3 gap-2">
                {ASSET_TYPES.map(a => (
                  <button
                    key={a.type}
                    onClick={() => selectAssetType(a.type)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs transition-colors ${
                      form.assetType === a.type
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span className="text-lg">{a.emoji}</span>
                    <span className="font-medium">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick presets */}
          {!isEdit && meta.presets && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">快选</Label>
              <div className="flex flex-wrap gap-2">
                {meta.presets.map(p => (
                  <button
                    key={p.ticker}
                    onClick={() => selectPreset(p.ticker, p.name)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.ticker === p.ticker
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {p.ticker} · {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ticker / Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {isMutualFund ? '基金名称 / 代码' : '交易代码 (Ticker)'}
            </Label>
            <Input
              placeholder={meta.tickerHint}
              value={form.ticker}
              onChange={e => set('ticker', isMutualFund ? e.target.value : e.target.value.toUpperCase())}
              className="h-10"
            />
            {!isMutualFund && (
              <p className="text-[10px] text-muted-foreground">
                {form.assetType === 'crypto' ? '🔗 使用 Yahoo Finance 格式，如 BTC-USD'
                  : form.assetType === 'gold' ? '🔗 GOLD-MYR-GRAM = 实时 RM/克（推荐）；GC=F = USD/oz'
                  : '🔗 KLSE 加 .KL 后缀，如 1155.KL'}
              </p>
            )}
            {isMutualFund && (
              <p className="text-[10px] text-amber-500">⚠️ 基金无实时价格，请手动填入当前 NAV</p>
            )}
          </div>

          {/* Company / Fund name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isMutualFund ? '基金全名' : '公司名称（选填）'}</Label>
            <Input
              placeholder={isMutualFund ? 'Amanah Saham Bumiputera' : 'Apple Inc.'}
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              className="h-10"
            />
          </div>

          {/* Units / Shares + Avg cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{meta.unitLabel}</Label>
              <Input
                type="number"
                step={form.assetType === 'crypto' ? '0.00000001' : '0.001'}
                placeholder={form.assetType === 'crypto' ? '0.05' : form.assetType === 'gold' ? '50' : '100'}
                value={form.shares}
                onChange={e => set('shares', e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isMutualFund ? '当前 NAV' : form.assetType === 'gold' ? '买入价 (per oz/g)' : '平均成本'}
              </Label>
              <Input
                type="number"
                step="0.0001"
                placeholder={form.assetType === 'gold' ? '310.00' : '1.00'}
                value={form.avg_cost_price}
                onChange={e => set('avg_cost_price', e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">货币</Label>
            <div className="grid grid-cols-4 gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => set('currency', c)}
                  className={`py-2 text-xs rounded-xl border font-medium transition-colors ${
                    form.currency === c
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">备注（选填）</Label>
            <Input placeholder="例：Maybank Gold Account" value={form.notes} onChange={e => set('notes', e.target.value)} className="h-10" />
          </div>

          {/* Cost preview */}
          {totalCost > 0 && (
            <div className="p-3 rounded-xl bg-muted flex justify-between items-center">
              <span className="text-xs text-muted-foreground">总成本</span>
              <span className="text-xs font-semibold">
                {form.currency} {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t.preview_saving : (isEdit ? '更新持仓' : '✅ 添加')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
