import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import TaxReliefCard from '@/components/tax/TaxReliefCard'
import TaxClient from '@/components/tax/TaxClient'
import { totalRelief } from '@/lib/utils/tax-calc'
import type { TaxFormType } from '@/lib/types/app.types'
import EmptyState from '@/components/ui/EmptyState'
import { getServerTranslations } from '@/lib/i18n/server'

interface Props {
  searchParams: Promise<{ year?: string }>
}

export default async function TaxPage({ searchParams }: Props) {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { t } = await getServerTranslations()
  const { year: yearParam } = await searchParams

  const thisYear = new Date().getFullYear()
  const assessmentYear = yearParam ? parseInt(yearParam, 10) : thisYear - 1

  // Fetch profile for tax form type
  const { data: profile } = await supabase
    .from('profiles')
    .select('tax_form_type')
    .eq('id', user.id)
    .single()

  const taxForm: TaxFormType = profile?.tax_form_type ?? 'BE'

  // Fetch this year's tax reliefs
  const { data: reliefs } = await supabase
    .from('tax_reliefs')
    .select('category, claimed_amount, max_allowed')
    .eq('user_id', user.id)
    .eq('assessment_year', assessmentYear)
    .order('created_at', { ascending: true })

  const reliefList = (reliefs ?? []).map(r => ({
    category: r.category as string,
    claimed_amount: Number(r.claimed_amount),
  }))

  const total = totalRelief(reliefList)

  return (
    <div>
      <PageHeader title={t.tax_title} showBack />

      {/* Client component: year nav + BE/B toggle + tabs */}
      <TaxClient
        year={assessmentYear}
        maxYear={thisYear - 1}
        taxForm={taxForm}
        reliefs={reliefList}
        totalRelief={total}
      >
        {reliefList.length === 0 ? (
          <EmptyState
            emoji="🏛️"
            title={t.empty_tax}
            body={t.empty_tax_hint}
          />
        ) : (
          <div className="space-y-2">
            {reliefList.map(r => (
              <TaxReliefCard
                key={r.category}
                category={r.category}
                claimedAmount={r.claimed_amount}
                year={assessmentYear}
              />
            ))}
          </div>
        )}
      </TaxClient>
    </div>
  )
}
