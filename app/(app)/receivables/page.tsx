import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import { getServerTranslations } from '@/lib/i18n/server'
import type { Receivable } from '@/lib/types/app.types'
import ReceivablesClient from './ReceivablesClient'

export default async function ReceivablesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t } = await getServerTranslations()

  const { data } = await supabase
    .from('receivables')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const all = (data ?? []) as Receivable[]
  const unpaid = all.filter(r => !r.is_paid)
  const paid = all.filter(r => r.is_paid)
  const totalOwed = unpaid.reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      <PageHeader title={t.receivables_title} showBack />

      {unpaid.length > 0 && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-muted-foreground">{t.receivables_total_owed}</p>
          <p className="text-2xl font-bold text-amber-600">
            RM {totalOwed.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{unpaid.length} 人欠款</p>
        </div>
      )}

      <ReceivablesClient unpaid={unpaid} paid={paid} />
    </div>
  )
}
