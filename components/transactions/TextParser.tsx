'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ParsedTransaction } from '@/lib/ai/parser'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  onParsed: (transactions: ParsedTransaction[]) => void
}

export default function TextParser({ onParsed }: Props) {
  const { t } = useLang()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleParse() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('type', 'text')
      fd.set('content', text.trim())
      const res = await fetch('/api/ingest', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? t.err_parse_failed)
      onParsed(data.transactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        className="w-full min-h-[100px] p-3 rounded-xl border border-border bg-muted text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        placeholder={t.qa_text_placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button
        className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
        onClick={handleParse}
        disabled={!text.trim() || loading}
      >
        {loading ? t.parser_analysing : t.parser_analyse}
      </Button>
    </div>
  )
}
