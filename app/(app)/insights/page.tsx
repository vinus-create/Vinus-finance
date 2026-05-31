import PageHeader from '@/components/layout/PageHeader'
import InsightsClient from '@/components/insights/InsightsClient'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getServerTranslations } from '@/lib/i18n/server'

export default async function InsightsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t } = await getServerTranslations()

  return (
    <div>
      <PageHeader title={t.insights_title} showBack />
      <InsightsClient />
    </div>
  )
}
