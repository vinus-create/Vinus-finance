'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { StockHolding } from '@/lib/types/app.types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  holding?: StockHolding
}

function blank() {
  return { ticker: '', company_name: '', exchange: '', shares: '', avg_cost_price: '', currency: 'USD', notes: '' }
}

function toForm(h: StockHolding) {
  return {
    ticker: h.ticker,
    company_name: h.company_name ?? '',
    exchange: h.exchange ?? '',
    shares: String(h.shares),
    avg_cost_price: String(h.avg_cost_price),
    currency: h.currency,
    notes: h.notes ?? '',
  }
}

const CURRENCIES = ['USD', 'MYR', 'SGD', 'HKD']

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

  const shares = parseFloat(form.shares) || 0
  const avgCost = parseFloat(form.avg_cost_price) || 0
  const totalCost = shares * avgCost

  async function handleSave() {
    if (!form.ticker.trim()) { setError(t.form_err_ticker); return }
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
        const { error: e } = await supabase.from('stock_holdings').insert({
          ...payload, user_id: user.id, is_active: true,
        })
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
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] overflow-y-auto">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{isEdit ? t.form_edit_holding : t.form_add_holding}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 mt-3 space-y-4">
          {/* Ticker + Exchange */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.form_ticker}</Label>
              <Input
                placeholder={t.form_ticker_placeholder}
                value={form.ticker}
                onChange={e => set('ticker', e.target.value.toUpperCase())}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.stocks_exchange}</Label>
              <Input
                placeholder="NASDAQ, KLSE..."
                value={form.exchange}
                onChange={e => set('exchange', e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Company name */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_company_name}</Label>
            <Input
              placeholder={t.form_company_placeholder}
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              className="h-10"
            />
          </div>

          {/* Shares + Avg cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.stocks_shares}</Label>
              <Input
                type="number"
                step="0.001"
                placeholder="100"
                value={form.shares}
                onChange={e => set('shares', e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.stocks_avg_cost}</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="125.50"
                value={form.avg_cost_price}
                onChange={e => set('avg_cost_price', e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label className="text-xs">Currency</Label>
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

          {/* Cost preview */}
          {totalCost > 0 && (
            <div className="p-3 rounded-xl bg-muted flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total Cost</span>
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
            {saving ? t.preview_saving : (isEdit ? t.form_update_holding : t.form_save_holding)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
