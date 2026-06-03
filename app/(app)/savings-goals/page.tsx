import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SavingsGoal } from '@/lib/types/app.types'
import SavingsGoalsClient from './SavingsGoalsClient'

export default async function SavingsGoalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t } = await getServerTranslations()

  const { data } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const goals = (data ?? []) as SavingsGoal[]
  const active = goals.filter(g => !g.is_completed)
  const completed = goals.filter(g => g.is_completed)
  const totalSaved = active.reduce((s, g) => s + g.current_amount, 0)
  const totalTarget = active.reduce((s, g) => s + g.target_amount, 0)

  return (
    <div>
      <PageHeader title={t.savings_goals_title} showBack />

      {active.length > 0 && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t.savings_goals_total_saved}</p>
            <p className="text-lg font-bold text-emerald-600">
              RM {totalSaved.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t.savings_goals_total_target}</p>
            <p className="text-lg font-bold">
              RM {totalTarget.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      <SavingsGoalsClient active={active} completed={completed} />
    </div>
  )
}
