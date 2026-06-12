'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { ParsedTransaction } from '@/lib/ai/parser'
import type { IngestMeta } from '@/lib/types/ingest.types'
import { useLang } from '@/lib/i18n/LanguageProvider'

export interface DetectedAccount {
  id: string
  name: string
  institution: string
  last4: string
  closing_balance: number | null
  statement_date?: string | null
  was_created: boolean
}

interface Props {
  onParsed: (transactions: ParsedTransaction[], detectedAccount?: DetectedAccount | null, meta?: IngestMeta | null) => void
}

const VALID_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png']

export default function PDFParser({ onParsed }: Props) {
  const { t } = useLang()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedAccount, setDetectedAccount] = useState<DetectedAccount | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(f: File) {
    if (!VALID_TYPES.includes(f.type)) {
      setError(t.parser_pdf_err_type)
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError(t.parser_pdf_err_size)
      return
    }
    setError(null)
    setFile(f)
    if (IMAGE_TYPES.includes(f.type)) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    handleFileSelect(f)
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setError(null)
    setDetectedAccount(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
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
      if (res.status === 409 && data.error === 'duplicate_file') {
        throw new Error('⚠️ 这份对账单已经导入过了（文件内容相同）。如需重新导入请删除旧批次。')
      }
      if (!data.success) throw new Error(data.error ?? t.err_parse_failed)
      const acct: DetectedAccount | null = data.detectedAccount ?? null
      setDetectedAccount(acct)
      onParsed(data.transactions, acct, {
        batchId: data.batchId ?? null,
        duplicates: data.duplicates ?? [],
        suspected: data.suspected ?? [],
        candidateAccount: data.candidateAccount ?? null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Hidden: file picker (PDF + gallery images) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf,image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Hidden: camera capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {file ? (
        /* ── File selected ── */
        <div>
          {preview ? (
            <div className="relative rounded-xl overflow-hidden bg-muted mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Statement"
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
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted mb-2">
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
          )}
        </div>
      ) : (
        /* ── No file: show upload options ── */
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-28 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground active:bg-muted transition-colors"
          >
            <span className="text-2xl">📂</span>
            <span className="text-xs font-medium text-center leading-tight">{t.parser_pdf_select}</span>
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="h-28 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground active:bg-muted transition-colors"
          >
            <span className="text-2xl">📷</span>
            <span className="text-xs font-medium">{t.parser_pdf_camera}</span>
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {file ? t.parser_pdf_hint : t.parser_pdf_max}
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
