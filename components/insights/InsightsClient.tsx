'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface DigestStats {
  totalIncome: number
  totalExpense: number
  txnCount: number
}

type Tab = 'analysis' | 'receipt'

export default function InsightsClient() {
  const { t } = useLang()
  const [tab, setTab] = useState<Tab>('analysis')

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">🤖 AI 消费分析</p>
        <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-1">
          {t.digest_last_week} · Powered by Gemini
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border overflow-hidden text-sm">
        <button
          onClick={() => setTab('analysis')}
          className={`flex-1 py-2.5 font-medium transition-colors ${tab === 'analysis' ? 'bg-emerald-500 text-white' : 'hover:bg-muted'}`}
        >
          📊 消费分析
        </button>
        <button
          onClick={() => setTab('receipt')}
          className={`flex-1 py-2.5 font-medium transition-colors ${tab === 'receipt' ? 'bg-emerald-500 text-white' : 'hover:bg-muted'}`}
        >
          📸 小票分析
        </button>
      </div>

      {tab === 'analysis' ? <SpendingAnalysis /> : <ReceiptAnalysis />}
    </div>
  )
}

// ─── Spending Analysis (existing) ────────────────────────────

function SpendingAnalysis() {
  const { t } = useLang()
  const [loading, setLoading] = useState(false)
  const [digest, setDigest] = useState<string | null>(null)
  const [stats, setStats] = useState<DigestStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generateDigest() {
    setLoading(true); setError(null); setDigest(null)
    try {
      const res = await fetch('/api/digest', { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed')
      setDigest(data.digest); setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleShare() {
    if (!digest) return
    const text = `My Vinus Finance AI spending report:\n\n${digest}`
    if (navigator.share) navigator.share({ title: 'My Weekly Spending Roast', text })
    else navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-4">
      <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold" onClick={generateDigest} disabled={loading}>
        {loading ? <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> {t.digest_generating}</span> : t.digest_generate_btn}
      </Button>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[['Income', `RM ${stats.totalIncome.toFixed(0)}`, 'text-emerald-600'], ['Spent', `RM ${stats.totalExpense.toFixed(0)}`, ''], ['Txns', String(stats.txnCount), '']].map(([label, val, cls]) => (
            <div key={label} className="p-3 rounded-xl bg-card border border-border text-center">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={`text-sm font-bold ${cls}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {digest ? (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{digest}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={handleShare}>{t.digest_share_btn}</Button>
        </div>
      ) : !loading && (
        <div className="text-center py-10 space-y-2">
          <p className="text-4xl">🤖</p>
          <p className="text-sm font-medium text-muted-foreground">{t.digest_empty}</p>
          <p className="text-xs text-muted-foreground">{t.digest_empty_hint}</p>
        </div>
      )}
    </div>
  )
}

// ─── Receipt Analysis ─────────────────────────────────────────

function ReceiptAnalysis() {
  const [image, setImage] = useState<string | null>(null)        // base64
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [preview, setPreview] = useState<string | null>(null)   // object URL for display
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMimeType(file.type || 'image/jpeg')
    setPreview(URL.createObjectURL(file))
    setAnalysis(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      // Strip data URL prefix to get pure base64
      setImage(result.split(',')[1] ?? '')
    }
    reader.readAsDataURL(file)
  }

  async function handleAnalyze() {
    if (!image) return
    setLoading(true); setError(null); setAnalysis(null)
    try {
      const res = await fetch('/api/ai/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: image, mimeType }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysis(data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setImage(null); setPreview(null); setAnalysis(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        className="relative border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-2xl overflow-hidden cursor-pointer hover:border-emerald-500 transition-colors"
      >
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Receipt" className="w-full max-h-72 object-contain bg-muted" />
            <button
              onClick={e => { e.stopPropagation(); handleClear() }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <span className="text-4xl">📸</span>
            <p className="text-sm font-medium">点击上传收据照片</p>
            <p className="text-xs text-muted-foreground">支持 JPG、PNG、WEBP</p>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {/* Analyze button */}
      {image && !analysis && (
        <Button
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> AI 分析中...</span>
          ) : '🤖 分析这张收据'}
        </Button>
      )}

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      {/* Analysis result */}
      {analysis && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-sm leading-relaxed whitespace-pre-line">{analysis}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="w-full" onClick={handleClear}>
              📸 换一张
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (navigator.share) navigator.share({ title: '收据分析', text: analysis })
                else navigator.clipboard.writeText(analysis).then(() => alert('已复制到剪贴板'))
              }}
            >
              分享结果
            </Button>
          </div>
        </div>
      )}

      {!image && !analysis && (
        <div className="text-center py-2 text-xs text-muted-foreground">
          上传超市、餐厅、网购等收据，AI 自动识别金额、商品明细并给出消费建议
        </div>
      )}
    </div>
  )
}
