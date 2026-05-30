'use client'

import { useState } from 'react'
import AddReminderSheet from './AddReminderSheet'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  children: React.ReactNode
}

export default function RemindersClient({ children }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const { t } = useLang()

  return (
    <>
      <div className="px-4 mt-4 pb-24">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t.reminders_active_header}
        </p>
        {children}
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-20 right-4 flex items-center gap-1.5 px-5 h-12 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 text-white text-sm font-semibold active:scale-95 transition-transform z-40"
      >
        {t.reminders_add_btn}
      </button>

      <AddReminderSheet open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}
