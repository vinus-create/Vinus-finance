'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EXPENSE_CATEGORY_MAP, INCOME_CATEGORY_MAP } from '@/lib/constants/categories'
import { getCategoryLabel } from '@/lib/utils/category-i18n'
import { cn } from '@/lib/utils'
import DeleteTransactionButton from './DeleteTransactionButton'
import EditTransactionSheet from './EditTransactionSheet'
import type { ExpenseCategory, IncomeCategory, TransactionType, LedgerType } from '@/lib/types/app.types'
import type { LangCode } from '@/lib/i18n'

interface Txn {
  id: string
  type: TransactionType
  amount: number
  currency: string
  description: string | null
  merchant_name: string | null
  expense_category: string | null
  income_category: string | null
  transaction_date: string
  transaction_time: string | null
  account_name: string
  ledger?: LedgerType
}

interface Props {
  txn: Txn
  lang: LangCode
}

export default function TransactionRow({ txn, lang }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [localTxn, setLocalTxn] = useState(txn)

  // Keep localTxn in sync with prop (after router.refresh() updates server data)
  useEffect(() => {
    if (!editing) setLocalTxn(txn)
  }, [txn, editing])

  const cat = localTxn.type === 'expense' && localTxn.expense_category
    ? EXPENSE_CATEGORY_MAP[localTxn.expense_category as ExpenseCategory]
    : localTxn.income_category
    ? INCOME_CATEGORY_MAP[localTxn.income_category as IncomeCategory]
    : undefined
  const icon = cat?.icon ?? (localTxn.type === 'income' ? '💰' : localTxn.type === 'transfer' ? '🔄' : '💸')
  const catValue = localTxn.type === 'expense' ? localTxn.expense_category : localTxn.income_category
  const label = catValue ? getCategoryLabel(catValue, localTxn.type, lang) : (localTxn.type === 'transfer' ? 'Transfer' : '')
  const name = localTxn.merchant_name ?? localTxn.description ?? label ?? 'Unnamed'

  return (
    <>
      <div
        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border active:bg-muted transition-colors cursor-pointer"
        onClick={() => setEditing(true)}
      >
        <span className="text-xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{name}</p>
            {localTxn.ledger === 'business' && (
              <span className="shrink-0 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                🏪
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {label && name !== label && (
              <p className="text-xs text-muted-foreground truncate">{label}</p>
            )}
            {localTxn.transaction_time && (
              <p className="text-xs text-muted-foreground shrink-0">{localTxn.transaction_time.slice(0, 5)}</p>
            )}
          </div>
        </div>
        <p className={cn(
          'text-sm font-semibold shrink-0',
          localTxn.type === 'income' ? 'text-emerald-600' : 'text-foreground'
        )}>
          {localTxn.type === 'income' ? '+' : '−'}RM {Number(localTxn.amount).toFixed(2)}
        </p>
        <div onClick={e => e.stopPropagation()}>
          <DeleteTransactionButton id={localTxn.id} />
        </div>
      </div>

      <EditTransactionSheet
        txn={localTxn}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          router.refresh()
        }}
      />
    </>
  )
}
