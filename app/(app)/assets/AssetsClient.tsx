'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import EmptyState from '@/components/ui/EmptyState'
import type { UserAsset, UserAssetType } from '@/lib/types/app.types'
import { cn } from '@/lib/utils'
import { useFabAction } from '@/lib/hooks/useFabAction'

const ASSET_TYPES: { value: UserAssetType; labelKey: string; emoji: string }[] = [
  { value: 'property',   labelKey: 'asset_type_property',  emoji: '🏠' },
  { value: 'vehicle',    labelKey: 'asset_type_vehicle',   emoji: '🚗' },
  { value: 'valuables',  labelKey: 'asset_type_valuables', emoji: '💎' },
  { value: 'business',   labelKey: 'asset_type_business',  emoji: '🏪' },
  { value: 'other',      labelKey: 'asset_type_other',     emoji: '📦' },
]

interface Props { assets: UserAsset[] }

export default function AssetsClient({ assets }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editAsset, setEditAsset] = useState<UserAsset | null>(null)
  useFabAction(() => { setEditAsset(null); setAddOpen(true) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState<UserAssetType>('property')
  const [estValue, setEstValue] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [description, setDescription] = useState('')

  function resetForm() {
    setName(''); setAssetType('property'); setEstValue('')
    setPurchasePrice(''); setPurchaseDate(''); setDescription(''); setError(null)
  }

  function openEdit(asset: UserAsset) {
    setName(asset.name)
    setAssetType(asset.asset_type)
    setEstValue(String(asset.estimated_value))
    setPurchasePrice(asset.purchase_price ? String(asset.purchase_price) : '')
    setPurchaseDate(asset.purchase_date ?? '')
    setDescription(asset.description ?? '')
    setEditAsset(asset)
    setError(null)
  }

  async function handleSave() {
    if (!name.trim() || !estValue) { setError(t.form_err_asset); return }
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)

      const payload = {
        name: name.trim(),
        asset_type: assetType,
        estimated_value: parseFloat(estValue),
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        purchase_date: purchaseDate || null,
        description: description.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editAsset) {
        await supabase.from('user_assets').update(payload).eq('id', editAsset.id)
        setEditAsset(null)
      } else {
        await supabase.from('user_assets').insert({ ...payload, user_id: user.id })
        setAddOpen(false)
      }
      resetForm(); router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.err_unknown)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.asset_delete_confirm)) return
    const supabase = createClient()
    await supabase.from('user_assets').delete().eq('id', id)
    router.refresh()
  }

  // Group by type
  const grouped = ASSET_TYPES.map(({ value, labelKey, emoji }) => ({
    type: value,
    label: t[labelKey as keyof typeof t] as string,
    emoji,
    items: assets.filter(a => a.asset_type === value),
  })).filter(g => g.items.length > 0)

  const AssetCard = ({ asset }: { asset: UserAsset }) => {
    const gain = asset.purchase_price !== null ? asset.estimated_value - asset.purchase_price : null
    return (
      <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{asset.name}</p>
            {asset.description && <p className="text-xs text-muted-foreground">{asset.description}</p>}
            {asset.purchase_date && <p className="text-xs text-muted-foreground">购入: {asset.purchase_date}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-blue-600">RM {asset.estimated_value.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
            {asset.purchase_price !== null && (
              <p className="text-xs text-muted-foreground">
                买价: RM {asset.purchase_price.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </p>
            )}
            {gain !== null && (
              <p className={cn('text-xs font-medium', gain >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {gain >= 0 ? '+' : ''}RM {gain.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(asset)} className="flex-1 h-7 text-xs">编辑</Button>
          <Button size="sm" variant="outline" onClick={() => handleDelete(asset.id)} className="flex-1 h-7 text-xs text-red-500 border-red-200 hover:bg-red-50">删除</Button>
        </div>
      </div>
    )
  }

  const FormSheet = ({ open, onClose, title }: { open: boolean; onClose: () => void; title: string }) => (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe">
        <SheetHeader className="mb-4"><SheetTitle>{title}</SheetTitle></SheetHeader>
        <div className="space-y-3 px-1 pb-6">
          {/* Asset type selector */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t.form_asset_type}</p>
            <div className="grid grid-cols-3 gap-2">
              {ASSET_TYPES.map(({ value, emoji, labelKey }) => (
                <button key={value} onClick={() => setAssetType(value)}
                  className={cn('flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-colors',
                    assetType === value ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700' : 'border-border hover:bg-muted')}>
                  <span className="text-xl">{emoji}</span>
                  <span>{(t[labelKey as keyof typeof t] as string).replace(/^[^\s]+ /, '')}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">{t.form_asset_name}</p>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="例：Taman Duta 房产、Proton X70" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.form_asset_est_value}</p>
              <Input type="number" min="0" step="0.01" value={estValue} onChange={e => setEstValue(e.target.value)} placeholder="350000" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.form_asset_purchase_price}</p>
              <Input type="number" min="0" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="300000" />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t.form_asset_purchase_date}</p>
            <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t.form_asset_desc}</p>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="例：Bayan Lepas 3室2厅" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11">
            {saving ? t.loading : t.form_save_asset}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )

  return (
    <div className="px-4 mt-4 pb-24 space-y-5">
      {assets.length === 0 ? (
        <EmptyState emoji="🏠" title={t.assets_empty} body={t.assets_empty_hint} />
      ) : (
        grouped.map(group => (
          <div key={group.type} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {group.emoji} {group.label.replace(/^[^\s]+ /, '')}
              </p>
              <p className="text-xs font-semibold text-blue-600">
                RM {group.items.reduce((s, a) => s + a.estimated_value, 0).toLocaleString('en-MY', { minimumFractionDigits: 0 })}
              </p>
            </div>
            {group.items.map(a => <AssetCard key={a.id} asset={a} />)}
          </div>
        ))
      )}


      <FormSheet open={addOpen} onClose={() => { setAddOpen(false); resetForm() }} title={t.form_add_asset} />
      <FormSheet open={!!editAsset} onClose={() => { setEditAsset(null); resetForm() }} title="编辑资产" />
    </div>
  )
}
