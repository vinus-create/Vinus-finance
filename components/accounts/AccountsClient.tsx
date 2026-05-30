'use client'

import { useState } from 'react'
import type { Account } from '@/lib/types/app.types'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { ACCOUNT_TYPE_CONFIG } from '@/lib/constants/accounts'
import AccountCard from './AccountCard'
import AddAccountSheet from './AddAccountSheet'
import EmptyState from '@/components/ui/EmptyState'

interface Props {
  accounts: Account[]
  netWorth: number
  totalAssets: number
  totalLiabilities: number
}

const TYPE_ORDER = ['bank', 'ewallet', 'investment', 'cash', 'credit_card', 'other'] as const

export default function AccountsClient({ accounts, netWorth, totalAssets, totalLiabilities }: Props) {
  const { t } = useLang()
  const [addOpen, setAddOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | undefined>()

  // Group by type
  const grouped = TYPE_ORDER.reduce((acc, type) => {
    const items = accounts.filter(a => a.account_type === type)
    if (items.length > 0) acc[type] = items
    return acc
  }, {} as Record<string, Account[]>)

  const typeLabel: Record<string, string> = {
    bank:        t.account_type_bank,
    ewallet:     t.account_type_ewallet,
    investment:  t.account_type_investment,
    cash:        t.account_type_cash,
    credit_card: t.account_type_credit,
    other:       t.account_type_other,
  }

  return (
    <div className="pb-28">
      {/* ── Net Worth Summary ── */}
      <div className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border">
        <p className="text-xs text-muted-foreground mb-1">{t.accounts_net_worth}</p>
        <p className={`text-3xl font-bold mb-4 ${netWorth >= 0 ? 'text-foreground' : 'text-red-500'}`}>
          RM {Math.abs(netWorth).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          {netWorth < 0 && <span className="text-base ml-1 font-normal text-red-400">(−)</span>}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
            <p className="text-[10px] text-muted-foreground">{t.accounts_total_assets}</p>
            <p className="text-sm font-bold text-emerald-600">
              RM {totalAssets.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30">
            <p className="text-[10px] text-muted-foreground">{t.accounts_total_liabilities}</p>
            <p className="text-sm font-bold text-red-500">
              RM {totalLiabilities.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Asset bar */}
        {(totalAssets + totalLiabilities) > 0 && (
          <div className="mt-3 h-2 bg-red-200 dark:bg-red-900/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min((totalAssets / (totalAssets + totalLiabilities)) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Account Groups ── */}
      {accounts.length === 0 ? (
        <div className="px-4 mt-6">
          <EmptyState
            emoji="🏦"
            title={t.empty_accounts}
            body={t.empty_accounts_hint}
          />
        </div>
      ) : (
        <div className="px-4 mt-5 space-y-5">
          {TYPE_ORDER.map(type => {
            const items = grouped[type]
            if (!items) return null
            const cfg = ACCOUNT_TYPE_CONFIG[type]
            const subtotal = items.reduce((s, a) => s + a.balance, 0)
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{cfg.emoji}</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {typeLabel[type]}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${subtotal < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                    RM {subtotal.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map(account => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onEdit={() => { setEditAccount(account); setAddOpen(true) }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add Account FAB ── */}
      <button
        onClick={() => { setEditAccount(undefined); setAddOpen(true) }}
        className="fixed bottom-20 right-4 flex items-center gap-1.5 px-5 h-12 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 text-white text-sm font-semibold active:scale-95 transition-transform z-40"
      >
        {t.accounts_add_btn}
      </button>

      <AddAccountSheet
        open={addOpen}
        onOpenChange={(o) => { setAddOpen(o); if (!o) setEditAccount(undefined) }}
        account={editAccount}
      />
    </div>
  )
}
