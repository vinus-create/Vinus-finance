'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import TextParser from './TextParser'
import VoiceParser from './VoiceParser'
import ReceiptParser from './ReceiptParser'
import PDFParser from './PDFParser'
import InvestmentParser from './InvestmentParser'
import TransferForm from './TransferForm'
import TransactionPreview from './TransactionPreview'
import type { ParsedTransaction } from '@/lib/ai/parser'
import type { DetectedAccount } from './PDFParser'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { useRouter } from 'next/navigation'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function QuickAddSheet({ open, onOpenChange }: Props) {
  const [parsed, setParsed] = useState<ParsedTransaction[] | null>(null)
  const [detectedAccount, setDetectedAccount] = useState<DetectedAccount | null>(null)
  const { t } = useLang()
  const router = useRouter()

  function handleParsed(transactions: ParsedTransaction[], acct?: DetectedAccount | null) {
    setParsed(transactions)
    setDetectedAccount(acct ?? null)
  }

  function handleDiscard() {
    setParsed(null)
    setDetectedAccount(null)
  }

  function handleSaved() {
    setParsed(null)
    setDetectedAccount(null)
    onOpenChange(false)
    router.refresh()
  }

  // Reset parsed state when sheet closes
  function handleOpenChange(next: boolean) {
    if (!next) { setParsed(null); setDetectedAccount(null) }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[88dvh] overflow-y-auto"
        showCloseButton={!parsed}
      >
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>
            {parsed ? t.qa_review : t.qa_add}
          </SheetTitle>
        </SheetHeader>

        {parsed ? (
          <TransactionPreview
            transactions={parsed}
            detectedAccount={detectedAccount}
            onDiscard={handleDiscard}
            onSaved={handleSaved}
          />
        ) : (
          <Tabs defaultValue="text" className="px-4 pb-4 mt-2">
            <TabsList className="w-full grid grid-cols-6 mb-4 h-auto p-1">
              <TabsTrigger value="text" className="text-xs py-2 flex-col gap-0.5 h-auto">
                <span>✍️</span>
                <span>{t.qa_text}</span>
              </TabsTrigger>
              <TabsTrigger value="voice" className="text-xs py-2 flex-col gap-0.5 h-auto">
                <span>🎤</span>
                <span>{t.qa_voice}</span>
              </TabsTrigger>
              <TabsTrigger value="receipt" className="text-xs py-2 flex-col gap-0.5 h-auto">
                <span>📷</span>
                <span>{t.qa_receipt}</span>
              </TabsTrigger>
              <TabsTrigger value="pdf" className="text-xs py-2 flex-col gap-0.5 h-auto">
                <span>📄</span>
                <span>{t.qa_pdf}</span>
              </TabsTrigger>
              <TabsTrigger value="investment" className="text-xs py-2 flex-col gap-0.5 h-auto">
                <span>📈</span>
                <span>{t.qa_investment}</span>
              </TabsTrigger>
              <TabsTrigger value="transfer" className="text-xs py-2 flex-col gap-0.5 h-auto">
                <span>↔️</span>
                <span>转账</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="text">
              <TextParser onParsed={handleParsed} />
            </TabsContent>
            <TabsContent value="voice">
              <VoiceParser onParsed={handleParsed} />
            </TabsContent>
            <TabsContent value="receipt">
              <ReceiptParser onParsed={handleParsed} />
            </TabsContent>
            <TabsContent value="pdf">
              <PDFParser onParsed={handleParsed} />
            </TabsContent>
            <TabsContent value="investment">
              <InvestmentParser onParsed={() => {}} />
            </TabsContent>
            <TabsContent value="transfer">
              <TransferForm onSaved={handleSaved} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}
