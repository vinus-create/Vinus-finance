'use client'

import { useLang } from '@/lib/i18n/LanguageProvider'
import type { LangCode } from '@/lib/i18n/index'

const LANGS: { code: LangCode; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ms', label: 'BM' },
  { code: 'zh', label: '中文' },
]

export default function AuthLangSwitcher() {
  const { lang, setLang } = useLang()

  return (
    <div className="flex items-center justify-center gap-1.5 mb-6">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            lang === code
              ? 'bg-emerald-500 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/70'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
