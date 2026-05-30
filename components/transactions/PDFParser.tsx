'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { ParsedTransaction } from '@/lib/ai/parser'
import { useLang } from '@/lib/i18n/LanguageProvider'

export interface DetectedAccount {
  id: string
  name: string
  institution: string
  last4: string
  closing_balance: number | null
  was_created: boolean
}

interface Props {
  onParsed: (transactions: ParsedTransaction[], detectedAccount?: DetectedAccount | null) => void
}

export default function PDFParser({ onParsed }: Props) {
  const { t } = useLang()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedAccount, setDetectedAccount] = useState<DetectedAccount | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      setError(t.parser_pdf_err_type)
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError(t.parser_pdf_err_size)
      return
    }
    setError(null)
    setFile(f)
  }

  function clearFile() {
    setFile(null)
    setError(null)
    setDetectedAccount(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleParse() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('type', 'pdf')
      fd.set('file', file)
      const res = await fetch('/api/ingest', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? t.err_parse_failed)
      const acct: DetectedAccount | null = data.detectedAccount ?? null
      setDetectedAccount(acct)
      onParsed(data.transactions, acct)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {file ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted">
          <span className="text-2xl shrink-0">📄</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
          <button
            onClick={clearFile}
            className="text-muted-foreground text-sm shrink-0 p-1"
            aria-label={t.preview_discard}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-36 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground active:bg-muted transition-colors"
        >
          <span className="text-3xl">📄</span>
          <span className="text-sm font-medium">{t.parser_pdf_select}</span>
          <span className="text-xs">{t.parser_pdf_max}</span>
        </button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {t.parser_pdf_hint}
      </p>

      {/* Detected account badge */}
      {detectedAccount && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
          detectedAccount.was_created
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
        }`}>
          <span className="text-base">🏦</span>
          <div>
            <p className="font-semibold">
              {detectedAccount.was_created ? '✨ New account created' : '✓ Linked to account'}
            </p>
            <p className="opacity-80">
              {detectedAccount.institution || detectedAccount.name}
              {detectedAccount.last4 && ` ••••${detectedAccount.last4}`}
              {detectedAccount.closing_balance !== null
                ? ` · Balance: RM ${detectedAccount.closing_balance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
                : ''}
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {file && (
        <Button
          className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
          onClick={handleParse}
          disabled={loading}
        >
          {loading ? t.parser_extracting : t.parser_extract}
        </Button>
      )}
    </div>
  )
}
