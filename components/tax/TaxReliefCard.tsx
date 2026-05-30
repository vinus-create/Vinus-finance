'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { RELIEF_MAP } from '@/lib/utils/tax-calc'
import { getReliefI18n } from '@/lib/utils/tax-relief-i18n'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  category: string
  claimedAmount: number
  year: number
}

export default function TaxReliefCard({ category, claimedAmount, year }: Props) {
  const router = useRouter()
  const { t, lang } = useLang()
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const meta = RELIEF_MAP[category]
  if (!meta) return null

  const i18n = getReliefI18n(category, lang)
  const cap = meta.cap
  const effective = cap != null ? Math.min(claimedAmount, cap) : claimedAmount
  const pct = cap != null && cap > 0 ? Math.min((effective / cap) * 100, 100) : 100

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)
      const { error } = await supabase
        .from('tax_reliefs')
        .delete()
        .eq('user_id', user.id)
        .eq('assessment_year', year)
        .eq('category', category)
      if (error) throw new Error(error.message)
      toast.success(i18n.label)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.err_unknown)
      setConfirmDel(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="border-0 bg-muted">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{i18n.label}</p>
            <p className="text-xs text-muted-foreground">{i18n.desc}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-sm font-semibold text-emerald-600">
                RM {effective.toFixed(2)}
              </p>
              {cap != null && (
                <p className="text-xs text-muted-foreground">/ RM {cap.toLocaleString()}</p>
              )}
            </div>
            {/* Delete */}
            {confirmDel ? (
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[10px] font-semibold text-red-500 hover:text-red-600 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/30"
                >
                  {deleting ? '…' : '✓'}
                </button>
                <button
                  onClick={() => setConfirmDel(false)}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5"
                >
                  {t.cancel}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded"
                title={t.tax_delete_relief_confirm}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        {cap != null && (
          <div className="h-1.5 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
