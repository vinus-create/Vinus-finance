import { getServerTranslations } from '@/lib/i18n/server'
import AuthLangSwitcher from './AuthLangSwitcher'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = await getServerTranslations()

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 py-8"
         style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))' }}>
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 mb-4">
            <span className="text-2xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Vinus Finance</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.auth_tagline}</p>
        </div>

        {/* Language switcher */}
        <AuthLangSwitcher />

        {children}
      </div>
    </div>
  )
}
