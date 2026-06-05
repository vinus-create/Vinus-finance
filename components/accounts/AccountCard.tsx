'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { ACCOUNT_TYPE_CONFIG } from '@/lib/constants/accounts'
import type { Account } from '@/lib/types/app.types'

interface Props {
  account: Account
  onEdit: () => void
}

export default function AccountCard({ account, onEdit }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cfg = ACCOUNT_TYPE_CONFIG[account.account_type]

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('id', account.id)
      if (error) throw new Error(error.message)
      toast.success(account.name)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.err_unknown)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const isNegative = account.balance < 0

  return (
    <div
      className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border active:bg-muted transition-colors cursor-pointer"
      onClick={() => router.push(`/accounts/${account.id}`)}
    >
      {/* Left: icon + info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: `${cfg.color}20` }}
        >
          <span>{cfg.emoji}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{account.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {account.institution ?? ''}
            {account.institution && account.account_number ? ' · ' : ''}
            {account.account_number ? `••••${account.account_number}` : ''}
            {!account.institution && !account.account_number && t.account_balance_label}
          </p>
        </div>
      </div>

      {/* Right: balance + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className={`text-sm font-bold ${isNegative ? 'text-red-500' : ''}`}>
            {isNegative ? '-' : ''}RM {Math.abs(account.balance).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </p>
          {!account.include_in_net_worth && (
            <p className="text-[9px] text-muted-foreground">excl. net worth</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 ml-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
            aria-label={t.form_edit_account}
          >
            ✏️
          </button>
          {confirmDelete ? (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[10px] px-2 py-1 rounded-lg bg-red-500 text-white"
              >
                ✓
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] px-2 py-1 rounded-lg border border-border"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-red-400"
              aria-label={t.delete}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
