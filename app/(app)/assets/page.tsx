import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import { getServerTranslations } from '@/lib/i18n/server'
import type { UserAsset } from '@/lib/types/app.types'
import AssetsClient from './AssetsClient'

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t } = await getServerTranslations()

  const { data } = await supabase
    .from('user_assets')
    .select('*')
    .eq('user_id', user.id)
    .order('estimated_value', { ascending: false })

  const assets = (data ?? []) as UserAsset[]
  const totalValue = assets.reduce((s, a) => s + a.estimated_value, 0)
  const totalCost = assets.reduce((s, a) => s + (a.purchase_price ?? 0), 0)

  return (
    <div>
      <PageHeader title={t.assets_title} showBack />

      {assets.length > 0 && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t.assets_total_value}</p>
            <p className="text-lg font-bold text-blue-600">
              RM {totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
          {totalCost > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">{t.asset_gain_loss}</p>
              <p className={`text-lg font-bold ${totalValue >= totalCost ? 'text-emerald-600' : 'text-red-500'}`}>
                {totalValue >= totalCost ? '+' : ''}RM {(totalValue - totalCost).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>
      )}

      <AssetsClient assets={assets} />
    </div>
  )
}
