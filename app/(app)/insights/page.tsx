import PageHeader from '@/components/layout/PageHeader'
import InsightsClient from '@/components/insights/InsightsClient'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import { redirect } from 'next/navigation'
import { getServerTranslations } from '@/lib/i18n/server'

export default async function InsightsPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { t } = await getServerTranslations()

  return (
    <div>
      <PageHeader title={t.insights_title} showBack />
      <InsightsClient />
    </div>
  )
}
