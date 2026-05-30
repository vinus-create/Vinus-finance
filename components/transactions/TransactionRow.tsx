'use client'

import { useState } from 'react'
import { EXPENSE_CATEGORY_MAP, INCOME_CATEGORY_MAP } from '@/lib/constants/categories'
import { getCategoryLabel } from '@/lib/utils/category-i18n'
import { cn } from '@/lib/utils'
import DeleteTransactionButton from './DeleteTransactionButton'
import EditTransactionSheet from './EditTransactionSheet'
import type { ExpenseCategory, IncomeCategory, TransactionType } from '@/lib/types/app.types'
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
  account_name: string
}

interface Props {
  txn: Txn
  lang: LangCode
}

export default function TransactionRow({ txn, lang }: Props) {
  const [editing, setEditing] = useState(false)
  const [localTxn, setLocalTxn] = useState(txn)

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
          <p className="text-sm font-medium truncate">{name}</p>
          {label && name !== label && (
            <p className="text-xs text-muted-foreground truncate">{label}</p>
          )}
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
          // Page will reload via router.refresh() — for now just close
          setEditing(false)
          // Trigger a full page refresh to show updated data
          window.location.reload()
        }}
      />
    </>
  )
}
