'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { ParsedTransaction } from '@/lib/ai/parser'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  onParsed: (transactions: ParsedTransaction[]) => void
}

const VALID_MIME = ['image/jpeg', 'image/png', 'image/webp']

export default function ReceiptParser({ onParsed }: Props) {
  const { t } = useLang()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!VALID_MIME.includes(f.type)) {
      setError(t.parser_receipt_err_type)
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError(t.parser_pdf_err_size)
      return
    }
    setError(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleParse() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('type', 'image')
      fd.set('file', file)
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
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {preview ? (
        <div className="relative rounded-xl overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Receipt"
            className="w-full max-h-52 object-contain"
          />
          <button
            onClick={clearFile}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold"
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
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium">{t.parser_receipt_select}</span>
          <span className="text-xs">{t.parser_receipt_formats}</span>
        </button>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {file && (
        <Button
          className="w-full bg-emerald-500 text-white hover:bg-emerald-600 h-11"
          onClick={handleParse}
          disabled={loading}
        >
          {loading ? t.parser_analysing_receipt : t.parser_analyse_receipt}
        </Button>
      )}
    </div>
  )
}
