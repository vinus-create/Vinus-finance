'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface DigestStats {
  totalIncome: number
  totalExpense: number
  txnCount: number
}

interface FinancialStats {
  avgMonthlyIncome: number
  avgMonthlyExpense: number
  savingsRate: number
  netWorth: number
  epfBalance: number
  debtServiceRatio: number
  age: number | null
}

type Tab = 'analysis' | 'receipt' | 'fortune' | 'financial'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'analysis',  label: '消费分析', emoji: '📊' },
  { id: 'receipt',   label: '小票分析', emoji: '🧾' },
  { id: 'fortune',   label: '财运分析', emoji: '🔮' },
  { id: 'financial', label: '财务评估', emoji: '👤' },
]

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

      {/* 4-tab grid */}
      <div className="grid grid-cols-4 rounded-xl border border-border overflow-hidden text-xs">
        {TABS.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex flex-col items-center gap-0.5 py-2.5 font-medium transition-colors ${
              tab === tb.id ? 'bg-emerald-500 text-white' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <span className="text-base">{tb.emoji}</span>
            <span>{tb.label}</span>
          </button>
        ))}
      </div>

      {tab === 'analysis'  && <SpendingAnalysis />}
      {tab === 'receipt'   && <ReceiptAnalysis />}
      {tab === 'fortune'   && <FortuneAnalysis />}
      {tab === 'financial' && <FinancialProfileAnalysis />}
    </div>
  )
}

// ─── Spending Analysis ────────────────────────────────────────

function SpendingAnalysis() {
  const { t } = useLang()
  const [loading, setLoading] = useState(false)
  const [digest, setDigest] = useState<string | null>(null)
  const [stats, setStats] = useState<DigestStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true); setError(null); setDigest(null)
    try {
      const res = await fetch('/api/digest', { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed')
      setDigest(data.digest); setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold" onClick={generate} disabled={loading}>
        {loading ? <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> {t.digest_generating}</span> : t.digest_generate_btn}
      </Button>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {([['收入', `RM ${stats.totalIncome.toFixed(0)}`, 'text-emerald-600'], ['支出', `RM ${stats.totalExpense.toFixed(0)}`, ''], ['交易', String(stats.txnCount), '']] as [string, string, string][]).map(([label, val, cls]) => (
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
          <Button variant="outline" className="w-full" onClick={() => {
            const text = `My Vinus Finance AI spending report:\n\n${digest}`
            if (navigator.share) navigator.share({ title: 'Weekly Spending', text })
            else navigator.clipboard.writeText(text)
          }}>{t.digest_share_btn}</Button>
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
  const [image, setImage] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMimeType(file.type || 'image/jpeg')
    setPreview(URL.createObjectURL(file))
    setAnalysis(null); setError(null)
    const reader = new FileReader()
    reader.onload = ev => setImage((ev.target?.result as string).split(',')[1] ?? '')
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
    } finally { setLoading(false) }
  }

  function handleClear() {
    setImage(null); setPreview(null); setAnalysis(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div onClick={() => fileRef.current?.click()}
        className="relative border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-2xl overflow-hidden cursor-pointer hover:border-emerald-500 transition-colors">
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Receipt" className="w-full max-h-72 object-contain bg-muted" />
            <button onClick={e => { e.stopPropagation(); handleClear() }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">✕</button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <span className="text-4xl">🧾</span>
            <p className="text-sm font-medium">点击拍摄或选择收据照片</p>
            <p className="text-xs text-muted-foreground">支持 JPG、PNG、WEBP</p>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      {image && !analysis && (
        <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold" onClick={handleAnalyze} disabled={loading}>
          {loading ? <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> AI 分析中...</span> : '🤖 分析这张收据'}
        </Button>
      )}
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      {analysis && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-sm leading-relaxed whitespace-pre-line">{analysis}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleClear}>🧾 重新上传</Button>
            <Button variant="outline" onClick={() => {
              if (navigator.share) navigator.share({ title: '收据分析', text: analysis })
              else navigator.clipboard.writeText(analysis)
            }}>分享结果</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Fortune Analysis ─────────────────────────────────────────

interface FortuneMeta {
  chineseZodiac: string
  westernZodiac: string
  lifePath: number
  age: number
  currentYear: number
}

function FortuneAnalysis() {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [meta, setMeta] = useState<FortuneMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needDob, setNeedDob] = useState(false)

  async function generate() {
    setLoading(true); setError(null); setAnalysis(null); setNeedDob(false)
    try {
      const res = await fetch('/api/ai/fortune', { method: 'POST' })
      const data = await res.json()
      if (data.needDob) { setNeedDob(true); return }
      if (data.error) throw new Error(data.error)
      setAnalysis(data.analysis); setMeta(data.meta)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      {/* Intro card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800">
        <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">🔮 AI 财运分析</p>
        <p className="text-xs text-purple-700/70 dark:text-purple-400/70 mt-1">
          结合生肖 · 星座 · 数字命理 · 马来西亚本地视角
        </p>
      </div>

      {needDob && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 space-y-1">
          <p className="font-semibold">🎂 需要填写出生日期</p>
          <p>前往 <strong>设置 → 个人资料</strong> 填写出生日期，才能查看财运分析。</p>
        </div>
      )}

      <Button
        className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-semibold"
        onClick={generate} disabled={loading}
      >
        {loading ? <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> 正在推算财运...</span> : '🔮 推算我的财运'}
      </Button>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      {meta && (
        <div className="grid grid-cols-4 gap-2 text-xs">
          {[
            { label: '生肖', value: meta.chineseZodiac + '年' },
            { label: '星座', value: meta.westernZodiac.split(' ')[0]! },
            { label: '命理数', value: String(meta.lifePath) },
            { label: '年龄', value: `${meta.age} 岁` },
          ].map(({ label, value }) => (
            <div key={label} className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-center">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="font-bold text-purple-700 dark:text-purple-300 text-xs">{value}</p>
            </div>
          ))}
        </div>
      )}

      {analysis && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => {
            if (navigator.share) navigator.share({ title: `${new Date().getFullYear()}财运分析`, text: analysis })
            else navigator.clipboard.writeText(analysis)
          }}>📤 分享财运报告</Button>
        </div>
      )}

      {!loading && !analysis && !needDob && (
        <div className="text-center py-8 space-y-2">
          <p className="text-5xl">🔮</p>
          <p className="text-sm font-medium text-muted-foreground">点击按钮推算你的财运</p>
          <p className="text-xs text-muted-foreground">基于生肖、星座、数字命理综合分析</p>
        </div>
      )}
    </div>
  )
}

// ─── Financial Profile Analysis ───────────────────────────────

function FinancialProfileAnalysis() {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true); setError(null); setAnalysis(null)
    try {
      const res = await fetch('/api/ai/financial-profile', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysis(data.analysis); setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败，请重试')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      {/* Intro card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">👤 AI 个人财务评估</p>
        <p className="text-xs text-blue-700/70 dark:text-blue-400/70 mt-1">
          收入 · 储蓄率 · 净资产 · EPF退休规划 · 马来西亚本地基准对比
        </p>
      </div>

      <Button
        className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-sm font-semibold"
        onClick={generate} disabled={loading}
      >
        {loading ? <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> 正在评估财务状况...</span> : '👤 评估我的财务状况'}
      </Button>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      {stats && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { label: '月均收入', value: `RM ${stats.avgMonthlyIncome.toFixed(0)}`, color: 'text-emerald-600' },
            { label: '月均支出', value: `RM ${stats.avgMonthlyExpense.toFixed(0)}`, color: 'text-orange-500' },
            { label: '储蓄率', value: `${stats.savingsRate}%`, color: stats.savingsRate >= 20 ? 'text-emerald-600' : 'text-red-500' },
            { label: '净资产', value: `RM ${(stats.netWorth / 1000).toFixed(0)}k`, color: stats.netWorth >= 0 ? 'text-blue-600' : 'text-red-500' },
            { label: 'EPF余额', value: `RM ${(stats.epfBalance / 1000).toFixed(0)}k`, color: 'text-blue-600' },
            { label: 'DSR', value: `${stats.debtServiceRatio}%`, color: stats.debtServiceRatio <= 30 ? 'text-emerald-600' : 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-center">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={`font-bold text-xs ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {analysis && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => {
            if (navigator.share) navigator.share({ title: '我的财务评估报告', text: analysis })
            else navigator.clipboard.writeText(analysis)
          }}>📤 分享评估报告</Button>
        </div>
      )}

      {!loading && !analysis && (
        <div className="text-center py-8 space-y-2">
          <p className="text-5xl">👤</p>
          <p className="text-sm font-medium text-muted-foreground">AI 为你做全面财务健康检查</p>
          <div className="text-xs text-muted-foreground space-y-0.5 mt-2">
            <p>📊 收入与同龄人对比</p>
            <p>💰 储蓄率健康度分析</p>
            <p>🏦 净资产 & EPF 退休规划</p>
            <p>✅ 3 个具体改善建议</p>
          </div>
        </div>
      )}
    </div>
  )
}
