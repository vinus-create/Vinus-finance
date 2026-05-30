'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { DATE_LOCALE } from '@/lib/i18n/index'

interface Props {
  year: number
  month: number  // 1–12
  basePath?: string  // e.g. '/dashboard' or '/transactions' (default)
}

export default function MonthNav({ year, month, basePath = '/transactions' }: Props) {
  const router = useRouter()
  const { t, lang } = useLang()

  function navigate(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    router.push(`${basePath}?month=${y}-${m}`, { scroll: false })
  }

  const label = new Date(year, month - 1, 1).toLocaleDateString(DATE_LOCALE[lang], {
    month: 'long',
    year: 'numeric',
  })

  const isCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth() + 1

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center justify-center w-9 h-9 rounded-full active:bg-muted transition-colors"
        aria-label={t.month_prev}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <span className="text-sm font-semibold capitalize">{label}</span>

      <button
        onClick={() => navigate(1)}
        disabled={isCurrentMonth}
        className="flex items-center justify-center w-9 h-9 rounded-full active:bg-muted transition-colors disabled:opacity-30"
        aria-label={t.month_next}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
