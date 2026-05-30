'use client'

import { createContext, useContext, useState } from 'react'
import type { LangCode, Translations } from './index'
import { LANG_COOKIE } from './index'

interface LangContextValue {
  lang: LangCode
  t: Translations
  setLang: (code: LangCode) => void
}

const LangContext = createContext<LangContextValue | null>(null)

export function LanguageProvider({
  initialLang,
  initialT,
  children,
}: {
  initialLang: LangCode
  initialT: Translations
  children: React.ReactNode
}) {
  const [lang, setLangState] = useState<LangCode>(initialLang)
  const [t, setT] = useState<Translations>(initialT)

  function setLang(code: LangCode) {
    // Write cookie (1 year)
    document.cookie = `${LANG_COOKIE}=${code}; path=/; max-age=31536000; SameSite=Lax`
    setLangState(code)
    // Reload to re-render all server components with new locale
    window.location.reload()
  }

  return (
    <LangContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>')
  return ctx
}
