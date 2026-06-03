'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import AddReliefSheet from './AddReliefSheet'
import TaxEstimator from './TaxEstimator'
import TaxPayments from './TaxPayments'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Relief {
  category: string
  claimed_amount: number
}

interface Props {
  year: number
  maxYear: number
  taxForm: 'BE' | 'B'
  reliefs: Relief[]
  children: React.ReactNode
  totalRelief: number
}

export default function TaxClient({ year, maxYear, taxForm, reliefs, children, totalRelief }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const [addOpen, setAddOpen] = useState(false)
  const [switchingForm, setSwitchingForm] = useState(false)

  function goYear(delta: number) {
    const next = year + delta
    router.push(`/tax?year=${next}`)
  }

  async function handleSwitchForm(form: 'BE' | 'B') {
    if (form === taxForm || switchingForm) return
    setSwitchingForm(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t.err_session)
      const { error } = await supabase.from('profiles').update({ tax_form_type: form }).eq('id', user.id)
      if (error) throw new Error(error.message)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setSwitchingForm(false)
    }
  }

  return (
    <>
      <div className="px-4 mt-4 space-y-3">

        {/* Year + BE/B bar */}
        <div className="p-3 rounded-2xl bg-card border border-border space-y-3">
          {/* Year navigation */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.tax_year_label}</p>
              <p className="text-2xl font-bold">{year}</p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => goYear(-1)}
                className="w-8 h-8 rounded-full border border-border hover:bg-muted flex items-center justify-center text-sm"
              >
                ‹
              </button>
              <button
                onClick={() => goYear(1)}
                disabled={year >= maxYear}
                className="w-8 h-8 rounded-full border border-border hover:bg-muted flex items-center justify-center text-sm disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>

          {/* BE / B toggle */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">{t.tax_form_label}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['BE', 'B'] as const).map(form => (
                <button
                  key={form}
                  onClick={() => handleSwitchForm(form)}
                  disabled={switchingForm}
                  className={`p-2.5 rounded-xl text-left border transition-colors ${
                    taxForm === form
                      ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/40'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <p className="text-sm font-bold">{form}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {form === 'BE' ? t.tax_form_be_hint : t.tax_form_b_hint}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="reliefs">
          <div className="flex items-center justify-between mb-3">
            <TabsList className="grid grid-cols-3 flex-1 mr-2">
              <TabsTrigger value="reliefs" className="text-xs">{t.tax_reliefs_tab}</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs">缴税记录</TabsTrigger>
              <TabsTrigger value="estimator" className="text-xs">{t.tax_estimate_tab}</TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              className="bg-emerald-500 text-white hover:bg-emerald-600 h-8 text-xs shrink-0"
              onClick={() => setAddOpen(true)}
            >
              {t.tax_add_btn}
            </Button>
          </div>

          <TabsContent value="reliefs">
            {children}
            {totalRelief > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-center">
                <p className="text-xs text-muted-foreground">{t.tax_total_relief}</p>
                <p className="text-xl font-bold text-emerald-600">
                  RM {totalRelief.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments">
            <TaxPayments year={year} />
          </TabsContent>

          <TabsContent value="estimator">
            <TaxEstimator reliefs={reliefs} />
          </TabsContent>
        </Tabs>
      </div>

      <AddReliefSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        year={year}
        taxForm={taxForm}
        existing={reliefs}
      />
    </>
  )
}
