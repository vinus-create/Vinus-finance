'use client'

import { useState } from 'react'
import AddReminderSheet from './AddReminderSheet'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { useFabAction } from '@/lib/hooks/useFabAction'

interface Props {
  children: React.ReactNode
}

export default function RemindersClient({ children }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const { t } = useLang()
  useFabAction(() => setAddOpen(true))

  return (
    <>
      <div className="px-4 mt-4 pb-24">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t.reminders_active_header}
        </p>
        {children}
      </div>

      <AddReminderSheet open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}
