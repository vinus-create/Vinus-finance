import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SavingsGoal } from '@/lib/types/app.types'
import SavingsGoalsClient from './SavingsGoalsClient'

function monthsRemaining(targetDate: string): number {
  const today = new Date()
  const target = new Date(targetDate)
  const months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth())
  return Math.max(0, months)
}

export default async function SavingsGoalsPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { t } = await getServerTranslations()

  const [{ data: goalsData }, { data: profile }] = await Promise.all([
    supabase.from('savings_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('date_of_birth').eq('id', user.id).single(),
  ])

  const goals = (goalsData ?? []) as SavingsGoal[]
  const userDob = (profile as { date_of_birth?: string | null } | null)?.date_of_birth ?? null

  const active = goals.filter(g => !g.is_completed)
  const completed = goals.filter(g => g.is_completed)

  const totalSaved = active.reduce((s, g) => s + g.current_amount, 0)
  const totalTarget = active.reduce((s, g) => s + g.target_amount, 0)

  // Sum monthly needed across all active goals that have a future target date
  const totalMonthlyNeeded = active
    .filter(g => g.target_date && monthsRemaining(g.target_date) > 0)
    .reduce((s, g) => {
      const months = monthsRemaining(g.target_date!)
      const remaining = Math.max(0, g.target_amount - g.current_amount)
      return s + Math.ceil(remaining / months)
    }, 0)

  return (
    <div>
      <PageHeader title={t.savings_goals_title} showBack />

      {active.length > 0 && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border space-y-3">
          <div className="grid grid-cols-2 gap-4">
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
          {totalMonthlyNeeded > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">每月需存总计</p>
              <p className="text-xl font-bold text-blue-600">
                RM {totalMonthlyNeeded.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ 月</span>
              </p>
            </div>
          )}
        </div>
      )}

      <SavingsGoalsClient active={active} completed={completed} userDob={userDob} />
    </div>
  )
}
