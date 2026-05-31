'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface DigestStats {
  totalIncome: number
  totalExpense: number
  txnCount: number
}

export default function InsightsClient() {
  const { t } = useLang()
  const [loading, setLoading] = useState(false)
  const [digest, setDigest] = useState<string | null>(null)
  const [stats, setStats] = useState<DigestStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generateDigest() {
    setLoading(true)
    setError(null)
    setDigest(null)
    try {
      const res = await fetch('/api/digest', { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed')
      setDigest(data.digest)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleShare() {
    if (!digest) return
    const text = `My Vinus Finance AI spending report:\n\n${digest}`
    if (navigator.share) {
      navigator.share({ title: 'My Weekly Spending Roast', text })
    } else {
      navigator.clipboard.writeText(text)
    }
  }

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {/* Header blurb */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">🤖 AI Spending Analysis</p>
        <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-1">
          {t.digest_last_week} · Powered by Gemini
        </p>
      </div>

      {/* Generate button */}
      <Button
        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold"
        onClick={generateDigest}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⏳</span> {t.digest_generating}
          </span>
        ) : t.digest_generate_btn}
      </Button>

      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-card border border-border text-center">
            <p className="text-[10px] text-muted-foreground">Income</p>
            <p className="text-sm font-bold text-emerald-600">RM {stats.totalIncome.toFixed(0)}</p>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border text-center">
            <p className="text-[10px] text-muted-foreground">Spent</p>
            <p className="text-sm font-bold">RM {stats.totalExpense.toFixed(0)}</p>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border text-center">
            <p className="text-[10px] text-muted-foreground">Txns</p>
            <p className="text-sm font-bold">{stats.txnCount}</p>
          </div>
        </div>
      )}

      {/* Digest output */}
      {digest ? (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{digest}</p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleShare}
          >
            {t.digest_share_btn}
          </Button>
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
