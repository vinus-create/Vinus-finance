'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useRef, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { useLang } from '@/lib/i18n/LanguageProvider'

export default function TransactionSearch() {
  const { t } = useLang()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const currentQ = searchParams.get('q') ?? ''

  function handleChange(value: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) {
        params.set('q', value.trim())
      } else {
        params.delete('q')
      }
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  function handleClear() {
    if (inputRef.current) inputRef.current.value = ''
    handleChange('')
    inputRef.current?.focus()
  }

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-muted border border-border focus-within:border-emerald-500 transition-colors">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          defaultValue={currentQ}
          onChange={e => handleChange(e.target.value)}
          placeholder={t.txn_search_placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {currentQ && (
          <button onClick={handleClear} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
