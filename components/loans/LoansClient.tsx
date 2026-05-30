'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import LoanCalculator from './LoanCalculator'
import AddLoanSheet from './AddLoanSheet'
import type { Loan } from '@/lib/types/app.types'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  loans: Loan[]
  children: React.ReactNode  // server-rendered loan cards
}

export default function LoansClient({ children }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('tracker')
  const { t } = useLang()

  return (
    <div className="px-4 mt-4 pb-24">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full mb-3">
          <TabsTrigger value="tracker">{t.loans_my}</TabsTrigger>
          <TabsTrigger value="calculator">{t.loans_calculator}</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker">
          {children}
        </TabsContent>

        <TabsContent value="calculator">
          <LoanCalculator />
        </TabsContent>
      </Tabs>

      {activeTab === 'tracker' && (
        <button
          onClick={() => setAddOpen(true)}
          className="fixed bottom-20 right-4 flex items-center gap-1.5 px-5 h-12 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 text-white text-sm font-semibold active:scale-95 transition-transform z-40"
          aria-label={t.loans_add_aria}
        >
          {t.loans_add_btn}
        </button>
      )}

      <AddLoanSheet open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
