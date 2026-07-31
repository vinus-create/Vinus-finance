import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import SignOutButton from './SignOutButton'
import LanguageSwitcher from './LanguageSwitcher'
import NotificationSettings from './NotificationSettings'
import EditProfileCard from './EditProfileCard'
import CategoryManager from './CategoryManager'
import RuleManager from './RuleManager'
import { getServerTranslations } from '@/lib/i18n/server'
import { APP_VERSION } from '@/lib/changelog'

export default async function SettingsPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { t } = await getServerTranslations()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email_reminders, tax_form_type, phone_number, telegram_id, date_of_birth')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <PageHeader title={t.settings_title} showBack />
      <div className="px-4 mt-4 space-y-4">
        <EditProfileCard
          initialName={profile?.full_name ?? null}
          initialPhone={(profile as { phone_number?: string | null })?.phone_number ?? null}
          initialTelegramId={(profile as { telegram_id?: number | null })?.telegram_id?.toString() ?? null}
          initialDob={(profile as { date_of_birth?: string | null })?.date_of_birth ?? null}
          email={user.email ?? ''}
        />

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 space-y-2">
            <p className="text-xs text-muted-foreground">{t.settings_language}</p>
            <LanguageSwitcher />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t.settings_notifications}
            </p>
            <NotificationSettings />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              🏷️ 自定义分类
            </p>
            <CategoryManager />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              ⚙️ 自动归类规则
            </p>
            <RuleManager />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{t.settings_version}</p>
                <p className="font-semibold text-sm">Vinus Finance</p>
                <p className="text-xs text-muted-foreground font-mono">V{APP_VERSION}</p>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-1 rounded-full font-medium">
                Latest
              </span>
            </div>
            <Separator />
            <Link
              href="/settings/changelog"
              className="flex items-center justify-between text-sm hover:text-emerald-600 transition-colors"
            >
              <span>📋 {t.settings_changelog}</span>
              <span className="text-muted-foreground text-xs">›</span>
            </Link>
          </CardContent>
        </Card>

        <SignOutButton />
      </div>
    </div>
  )
}
