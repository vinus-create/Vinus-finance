'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { ParsedStockTrade, InvestmentStatementInfo } from '@/lib/ai/parser'

interface Props {
  onParsed: (trades: ParsedStockTrade[], info: InvestmentStatementInfo | null) => void
}

export default function InvestmentParser({ onParsed }: Props) {
  const { t } = useLang()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ trades: ParsedStockTrade[]; info: InvestmentStatementInfo | null } | null>(null)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') { setError('PDF files only'); return }
    if (f.size > 20 * 1024 * 1024) { setError('Max 20 MB'); return }
    setError(null)
    setFile(f)
    setResult(null)
    setSaved(false)
  }

  async function handleParse() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('type', 'investment')
      fd.set('file', file)
      const res = await fetch('/api/ingest', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? t.err_parse_failed)
      setResult({ trades: data.trades, info: data.statementInfo })
      onParsed(data.trades, data.statementInfo)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set('type', 'investment')
      fd.set('file', file)
      fd.set('save', 'true')
      const res = await fetch('/api/ingest', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Save failed')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />

      <p className="text-xs text-muted-foreground text-center">{t.parser_investment_hint}</p>

      {!file ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-36 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground active:bg-muted transition-colors"
        >
          <span className="text-3xl">📈</span>
          <span className="text-sm font-medium">{t.parser_investment_select}</span>
          <span className="text-xs">Moomoo · AHAM · EPF · Rakuten · IBKR</span>
        </button>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted">
          <span className="text-2xl shrink-0">📈</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <button onClick={() => { setFile(null); setResult(null) }} className="text-muted-foreground p-1">✕</button>
        </div>
      )}

      {/* Statement info badge */}
      {result?.info && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 text-xs">
          <span className="text-base">📊</span>
          <div>
            <p className="font-semibold">{result.info.broker_name} · {result.info.account_holder}</p>
            <p className="opacity-80">
              {result.trades.length} trades detected
              {result.info.total_value ? ` · Portfolio: ${result.info.currency} ${result.info.total_value.toLocaleString()}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Trade preview */}
      {result && result.trades.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
          {result.trades.slice(0, 20).map((trade, i) => (
            <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg bg-muted/50">
              <span className={trade.trade_type === 'buy' ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                {trade.trade_type === 'buy' ? '▲' : '▼'}
              </span>
              <span className="font-semibold">{trade.ticker}</span>
              <span className="text-muted-foreground flex-1">{trade.shares} units @ {trade.price_per_share}</span>
              <span className="font-medium">{trade.currency} {trade.total_amount.toFixed(2)}</span>
            </div>
          ))}
          {result.trades.length > 20 && (
            <p className="text-center text-xs text-muted-foreground py-1">+{result.trades.length - 20} more</p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {saved && (
        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-sm text-center font-semibold">
          ✅ {result?.trades.length} trades saved to portfolio!
        </div>
      )}

      {file && !saved && (
        <div className="space-y-2">
          {!result ? (
            <Button
              className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
              onClick={handleParse}
              disabled={loading}
            >
              {loading ? '⏳ Analysing...' : '📈 Analyse Statement'}
            </Button>
          ) : (
            <Button
              className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? '⏳ Saving...' : `💾 Save ${result.trades.length} Trades`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
