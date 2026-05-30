'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AddWatchlistSheet({ open, onOpenChange }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ ticker: '', company_name: '', exchange: '', target_price: '' })

  useEffect(() => {
    if (open) setForm({ ticker: '', company_name: '', exchange: '', target_price: '' })
  }, [open])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.ticker.trim()) { setError(t.form_err_ticker); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)

      const { error: e } = await supabase.from('stock_watchlist').insert({
        user_id: user.id,
        ticker: form.ticker.trim().toUpperCase(),
        company_name: form.company_name.trim() || null,
        exchange: form.exchange.trim() || null,
        target_price: form.target_price ? parseFloat(form.target_price) : null,
        added_at: new Date().toISOString(),
      })
      if (e) throw new Error(e.message)

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
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>{t.stocks_add_watchlist}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 mt-3 space-y-4">
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

          <div className="space-y-1.5">
            <Label className="text-xs">{t.form_company_name}</Label>
            <Input
              placeholder={t.form_company_placeholder}
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t.stocks_target_price}</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="150.00"
              value={form.target_price}
              onChange={e => set('target_price', e.target.value)}
              className="h-10"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t.preview_saving : t.save}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
