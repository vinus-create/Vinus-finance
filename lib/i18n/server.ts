import { cookies } from 'next/headers'
import { type LangCode, type Translations, LANG_COOKIE, DEFAULT_LANG } from './index'
import { ms } from './locales/ms'
import { en } from './locales/en'
import { zh } from './locales/zh'

const LOCALES: Record<LangCode, Translations> = { ms, en, zh }

export async function getServerTranslations(): Promise<{ t: Translations; lang: LangCode }> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(LANG_COOKIE)?.value
  const lang: LangCode = (raw === 'ms' || raw === 'en' || raw === 'zh') ? raw : DEFAULT_LANG
  return { t: LOCALES[lang], lang }
}
