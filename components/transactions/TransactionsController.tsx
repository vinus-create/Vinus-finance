'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import QuickAddSheet from './QuickAddSheet'

/**
 * Reads ?new=1 from URL and auto-opens QuickAddSheet.
 * Cleans the URL param after opening.
 */
export default function TransactionsController() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setSheetOpen(true)
      // Clean the URL without a navigation
      router.replace('/transactions', { scroll: false })
    }
  }, [searchParams, router])

  return (
    <QuickAddSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
    />
  )
}
