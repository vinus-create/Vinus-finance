'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import LoanCalculator from './LoanCalculator'
import AddLoanSheet from './AddLoanSheet'
import type { Loan } from '@/lib/types/app.types'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { useFabAction } from '@/lib/hooks/useFabAction'

interface Props {
  loans: Loan[]
  children: React.ReactNode  // server-rendered loan cards
}

export default function LoansClient({ children }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('tracker')
  const { t } = useLang()
  useFabAction(() => setAddOpen(true))

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

      <AddLoanSheet open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
