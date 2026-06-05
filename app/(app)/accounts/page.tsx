import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import AccountsClient from '@/components/accounts/AccountsClient'
import { getServerTranslations } from '@/lib/i18n/server'
import type { Account } from '@/lib/types/app.types'

// ─── Run in Supabase SQL editor to activate Accounts module ──
//
// CREATE TABLE IF NOT EXISTS accounts (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
//   name text NOT NULL,
//   account_type text NOT NULL DEFAULT 'bank'
//     CHECK (account_type IN ('bank','ewallet','investment','cash','credit_card','other')),
//   institution text,
//   account_number text,
//   balance numeric NOT NULL DEFAULT 0,
//   currency text NOT NULL DEFAULT 'MYR',
//   color text,
//   is_active boolean NOT NULL DEFAULT true,
//   include_in_net_worth boolean NOT NULL DEFAULT true,
//   notes text,
//   created_at timestamptz DEFAULT now(),
//   updated_at timestamptz DEFAULT now()
// );
// ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users manage own accounts" ON accounts
//   FOR ALL USING (auth.uid() = user_id);

export default async function AccountsPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { t } = await getServerTranslations()

  const [accountsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  let accounts = (accountsRes.error ? [] : (accountsRes.data ?? [])) as Account[]

  // Ensure at least a "Cash" account always exists
  if (accounts.length === 0) {
    const { data: created } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        name: 'Cash',
        account_type: 'cash',
        balance: 0,
        currency: 'MYR',
        is_active: true,
        include_in_net_worth: true,
      })
      .select('*')
      .single()
    if (created) accounts = [created as Account]
  }
  // Net worth = accounts only. Loans are tracked separately on the Loans page.
  const assets = accounts
    .filter(a => a.include_in_net_worth && a.balance >= 0)
    .reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = accounts
    .filter(a => a.include_in_net_worth && a.balance < 0)
    .reduce((s, a) => s + Math.abs(a.balance), 0)
  const netWorth = assets - totalLiabilities

  return (
    <div>
      <PageHeader title={t.accounts_title} />
      <Suspense>
        <AccountsClient
          accounts={accounts}
          netWorth={netWorth}
          totalAssets={assets}
          totalLiabilities={totalLiabilities}
        />
      </Suspense>
    </div>
  )
}
