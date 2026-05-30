'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  id: string
}

export default function DeleteTransactionButton({ id }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('transactions').delete().eq('id', id)
    router.refresh()
    setLoading(false)
    setConfirm(false)
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-500 font-semibold px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 active:opacity-70"
        >
          {loading ? '...' : t.delete}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-muted active:opacity-70"
        >
          {t.cancel}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="shrink-0 p-1.5 rounded-lg text-muted-foreground active:bg-muted transition-colors"
      aria-label={t.delete}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
