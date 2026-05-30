'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { ParsedTransaction } from '@/lib/ai/parser'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  onParsed: (transactions: ParsedTransaction[]) => void
}

/** Pick the best audio MIME type supported by this browser + accepted by Gemini */
function getBestMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  if (typeof MediaRecorder === 'undefined') return ''
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

const MAX_SECONDS = 60

export default function VoiceParser({ onParsed }: Props) {
  const { t } = useLang()
  const [supported, setSupported] = useState(true)
  const [recording, setRecording] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) {
      setSupported(false)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  async function startRecording() {
    setError(null)
    setElapsed(0)
    chunksRef.current = []

    const mimeType = getBestMimeType()
    if (!mimeType) { setSupported(false); return }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError(t.qa_voice_no_mic)
      return
    }

    const mr = new MediaRecorder(stream, { mimeType })
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      handleAudioReady(mimeType)
    }
    mr.start(200) // collect chunks every 200ms
    mediaRef.current = mr
    setRecording(true)

    // Auto-stop at MAX_SECONDS
    timerRef.current = setInterval(() => {
      setElapsed(s => {
        if (s + 1 >= MAX_SECONDS) { stopRecording(); return MAX_SECONDS }
        return s + 1
      })
    }, 1000)
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    mediaRef.current?.stop()
    mediaRef.current = null
    setRecording(false)
  }

  async function handleAudioReady(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType })
    if (blob.size === 0) { setError(t.qa_voice_empty); return }

    setAnalysing(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('type', 'voice')
      // Strip codec params from MIME type for the File object
      const baseMime = mimeType.split(';')[0]
      const ext = baseMime.includes('ogg') ? 'ogg' : baseMime.includes('mp4') ? 'mp4' : 'webm'
      fd.set('file', new File([blob], `voice.${ext}`, { type: baseMime }))
      const res = await fetch('/api/ingest', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? t.err_parse_failed)
      onParsed(data.transactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setAnalysing(false)
    }
  }

  if (!supported) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm space-y-2">
        <p className="text-4xl">🎤</p>
        <p>{t.qa_voice_unsupported}</p>
        <p className="text-xs">{t.qa_voice_browser_hint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-2">
      {/* Mic button */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {/* Pulse ring when recording */}
          {recording && (
            <>
              <div className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
              <div className="absolute -inset-3 rounded-full bg-red-400/20 animate-pulse" />
            </>
          )}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={analysing}
            className={cn(
              'relative w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all shadow-lg z-10',
              recording
                ? 'bg-red-500 shadow-red-500/40'
                : analysing
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-emerald-500 shadow-emerald-500/30 active:scale-95'
            )}
          >
            {analysing ? '⏳' : recording ? '⏹' : '🎤'}
          </button>
        </div>

        {/* Status text */}
        <p className="text-sm text-center text-muted-foreground">
          {analysing
            ? t.parser_analysing
            : recording
            ? <span className="flex items-center gap-1.5 font-mono text-red-500">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                {formatSeconds(elapsed)} / {formatSeconds(MAX_SECONDS)}
              </span>
            : t.qa_voice_tap}
        </p>
      </div>

      {/* Hint */}
      {!recording && !analysing && (
        <div className="rounded-xl bg-muted/60 p-3 space-y-1.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{t.qa_voice_examples_title}</p>
          <p>🇲🇾 &ldquo;Tadi beli mcd, lapan ringgit lima puluh&rdquo;</p>
          <p>🇨🇳 &ldquo;刚才买 grab food 二十块&rdquo;</p>
          <p>🌏 &ldquo;Paid tol RM4.20 just now lah&rdquo;</p>
          <p>🗣️ &ldquo;Gaji masuk, tiga ribu lima ratus&rdquo;</p>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
