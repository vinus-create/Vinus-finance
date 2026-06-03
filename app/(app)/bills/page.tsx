import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import BillsClient from '@/components/bills/BillsClient'

export default async function BillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bills } = await supabase
    .from('monthly_bills')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('due_day', { ascending: true })

  // Monthly equivalent (divide by frequency for bills paid less often than monthly)
  const totalMonthly = (bills ?? []).reduce((s, b) => s + Number(b.amount), 0)

  return (
    <div>
      <PageHeader title="每月账单" />
      <div className="px-4 pb-24">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-xs text-muted-foreground">每月固定支出</p>
            <p className="text-xl font-bold text-red-500 mt-1">
              RM {totalMonthly.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-xs text-muted-foreground">账单数量</p>
            <p className="text-xl font-bold mt-1">{(bills ?? []).length} 项</p>
          </div>
        </div>

        <BillsClient initialBills={bills ?? []} />
      </div>
    </div>
  )
}
