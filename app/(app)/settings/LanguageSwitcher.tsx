'use client'

import { useLang } from '@/lib/i18n/LanguageProvider'
import type { LangCode } from '@/lib/i18n/index'
import { cn } from '@/lib/utils'

const LANGS: { code: LangCode; label: string }[] = [
  { code: 'ms', label: 'BM' },
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
]

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang()

  return (
    <div className="flex gap-2">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
            lang === code
              ? 'bg-emerald-500 text-white'
              : 'bg-muted text-muted-foreground active:bg-muted/70'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
