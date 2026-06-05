import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import StocksClient from '@/components/stocks/StocksClient'
import { getServerTranslations } from '@/lib/i18n/server'
import type { StockHolding, StockTrade, StockWatchlist } from '@/lib/types/app.types'

// ─── SQL to create tables (run in Supabase SQL editor) ────────
// CREATE TABLE IF NOT EXISTS stock_holdings (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
//   ticker text NOT NULL,
//   company_name text,
//   exchange text,
//   shares numeric NOT NULL DEFAULT 0,
//   avg_cost_price numeric NOT NULL DEFAULT 0,
//   currency text NOT NULL DEFAULT 'USD',
//   notes text,
//   is_active boolean NOT NULL DEFAULT true,
//   created_at timestamptz DEFAULT now(),
//   updated_at timestamptz DEFAULT now()
// );
// ALTER TABLE stock_holdings ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users manage own holdings" ON stock_holdings FOR ALL USING (auth.uid() = user_id);
//
// CREATE TABLE IF NOT EXISTS stock_trades (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
//   ticker text NOT NULL,
//   company_name text,
//   trade_type text NOT NULL CHECK (trade_type IN ('buy', 'sell')),
//   shares numeric NOT NULL,
//   price_per_share numeric NOT NULL,
//   total_amount numeric NOT NULL,
//   fees numeric NOT NULL DEFAULT 0,
//   trade_date date NOT NULL,
//   notes text,
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE stock_trades ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users manage own trades" ON stock_trades FOR ALL USING (auth.uid() = user_id);
//
// CREATE TABLE IF NOT EXISTS stock_watchlist (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
//   ticker text NOT NULL,
//   company_name text,
//   exchange text,
//   target_price numeric,
//   notes text,
//   added_at timestamptz DEFAULT now()
// );
// ALTER TABLE stock_watchlist ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users manage own watchlist" ON stock_watchlist FOR ALL USING (auth.uid() = user_id);

export default async function StocksPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { t } = await getServerTranslations()

  // Fetch all stock data — gracefully handle missing tables
  const [holdingsRes, tradesRes, watchlistRes] = await Promise.all([
    supabase
      .from('stock_holdings')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('stock_trades')
      .select('*')
      .eq('user_id', user.id)
      .order('trade_date', { ascending: false })
      .limit(100),
    supabase
      .from('stock_watchlist')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false }),
  ])

  const holdings = holdingsRes.error ? [] : (holdingsRes.data ?? []) as StockHolding[]
  const trades = tradesRes.error ? [] : (tradesRes.data ?? []) as StockTrade[]
  const watchlist = watchlistRes.error ? [] : (watchlistRes.data ?? []) as StockWatchlist[]

  return (
    <div>
      <PageHeader title={t.stocks_title} showBack />
      <Suspense>
        <StocksClient holdings={holdings} trades={trades} watchlist={watchlist} />
      </Suspense>
    </div>
  )
}
