import { createAdminClient } from '@/lib/supabase/admin'

export interface AdminStats {
  totalUsers: number
  activeUsersLast30d: number
  newUsersThisMonth: number
  totalTransactions: number
  totalVolumeMYR: number
  aiParseUsers: number
  telegramUsers: number
  stockUsers: number
}

export interface AdminUser {
  id: string
  full_name: string | null
  email: string
  created_at: string
  tx_count: number
  is_suspended: boolean
}

export interface AdminUserDetail {
  id: string
  full_name: string | null
  email: string
  phone_number: string | null
  state: string | null
  created_at: string
  onboarding_done: boolean
  is_suspended: boolean
  tx_count: number
  account_count: number
  loan_count: number
  goal_count: number
  total_income: number
  total_expense: number
  net_worth: number
  recent_transactions: Array<{
    id: string
    transaction_date: string
    type: string
    amount: number
    currency: string
    description: string
    expense_category: string | null
    income_category: string | null
    merchant_name: string | null
  }>
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createAdminClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { data: recentTxUsers },
    { count: newUsers },
    { count: totalTx },
    { data: volumeData },
    { count: telegramCount },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('transactions').select('user_id').gte('transaction_date', thirtyDaysAgo.slice(0, 10)),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
    supabase.from('transactions').select('amount, currency').eq('type', 'expense'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).not('telegram_id', 'is', null),
  ])

  const activeSet = new Set((recentTxUsers ?? []).map((r: { user_id: string }) => r.user_id))
  const myrVolume = (volumeData ?? []).reduce((sum: number, r: { amount: number; currency: string }) =>
    r.currency === 'MYR' ? sum + r.amount : sum, 0)

  // Distinct users who used AI parse and have stock holdings
  const [{ data: aiUserRows }, { data: stockUserRows }] = await Promise.all([
    supabase.from('transactions').select('user_id').not('merchant_name', 'is', null),
    supabase.from('stock_holdings').select('user_id'),
  ])
  const aiParseUsers = new Set((aiUserRows ?? []).map((r: { user_id: string }) => r.user_id)).size
  const stockUsers = new Set((stockUserRows ?? []).map((r: { user_id: string }) => r.user_id)).size

  return {
    totalUsers: totalUsers ?? 0,
    activeUsersLast30d: activeSet.size,
    newUsersThisMonth: newUsers ?? 0,
    totalTransactions: totalTx ?? 0,
    totalVolumeMYR: Math.round(myrVolume),
    aiParseUsers,
    telegramUsers: telegramCount ?? 0,
    stockUsers,
  }
}

export async function getAllUsers(page: number, q: string, status: string): Promise<{ users: AdminUser[]; total: number }> {
  const supabase = createAdminClient()
  const pageSize = 25
  const offset = (page - 1) * pageSize

  // Get auth users (for emails)
  const { data: authList } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
  const emailMap = new Map<string, string>()
  for (const u of authList?.users ?? []) emailMap.set(u.id, u.email ?? '')

  let query = supabase
    .from('profiles')
    .select('id, full_name, created_at, is_suspended', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (status === 'active') query = query.eq('is_suspended', false)
  else if (status === 'suspended') query = query.eq('is_suspended', true)

  const { data: profiles, count } = await query

  // Get tx counts per user
  const ids = (profiles ?? []).map((p: { id: string }) => p.id)
  const { data: txCounts } = await supabase
    .from('transactions')
    .select('user_id')
    .in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

  const txMap = new Map<string, number>()
  for (const row of txCounts ?? []) txMap.set(row.user_id, (txMap.get(row.user_id) ?? 0) + 1)

  let users: AdminUser[] = (profiles ?? []).map((p: { id: string; full_name: string | null; created_at: string; is_suspended: boolean }) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailMap.get(p.id) ?? '',
    created_at: p.created_at,
    tx_count: txMap.get(p.id) ?? 0,
    is_suspended: p.is_suspended ?? false,
  }))

  if (q) {
    const lower = q.toLowerCase()
    users = users.filter(u =>
      (u.full_name ?? '').toLowerCase().includes(lower) ||
      u.email.toLowerCase().includes(lower)
    )
  }

  return { users, total: count ?? 0 }
}

export async function getUserDetail(id: string): Promise<AdminUserDetail | null> {
  const supabase = createAdminClient()

  const [
    { data: profile },
    { data: authUser },
    { data: txns },
    { data: accounts },
    { count: loanCount },
    { count: goalCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.auth.admin.getUserById(id),
    supabase.from('transactions').select('id, transaction_date, type, amount, currency, description, expense_category, income_category, merchant_name').eq('user_id', id).order('transaction_date', { ascending: false }).limit(20),
    supabase.from('accounts').select('balance, currency, account_type').eq('user_id', id).eq('is_active', true),
    supabase.from('loans').select('id', { count: 'exact', head: true }).eq('user_id', id).eq('is_active', true),
    supabase.from('savings_goals').select('id', { count: 'exact', head: true }).eq('user_id', id),
  ])

  if (!profile) return null

  const allTxns = txns ?? []
  const income = allTxns.filter((t: { type: string }) => t.type === 'income').reduce((s: number, t: { amount: number }) => s + t.amount, 0)
  const expense = allTxns.filter((t: { type: string }) => t.type === 'expense').reduce((s: number, t: { amount: number }) => s + t.amount, 0)
  const netWorth = (accounts ?? []).reduce((s: number, a: { balance: number; account_type: string }) =>
    a.account_type === 'credit_card' ? s - a.balance : s + a.balance, 0)

  // Get full tx count
  const { count: txCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)

  return {
    id,
    full_name: profile.full_name,
    email: authUser.user?.email ?? '',
    phone_number: profile.phone_number,
    state: profile.state,
    created_at: profile.created_at,
    onboarding_done: profile.onboarding_done,
    is_suspended: profile.is_suspended ?? false,
    tx_count: txCount ?? 0,
    account_count: (accounts ?? []).length,
    loan_count: loanCount ?? 0,
    goal_count: goalCount ?? 0,
    total_income: income,
    total_expense: expense,
    net_worth: netWorth,
    recent_transactions: allTxns,
  }
}

export async function getNewUsersPerWeek(): Promise<Array<{ week: string; count: number }>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at')

  const buckets = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000)
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 10)
    buckets.set(key, 0)
  }
  for (const row of data ?? []) {
    const d = new Date(row.created_at)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
    else {
      // find closest key
      for (const [k] of buckets) {
        if (Math.abs(new Date(k).getTime() - monday.getTime()) < 7 * 24 * 60 * 60 * 1000) {
          buckets.set(k, (buckets.get(k) ?? 0) + 1)
          break
        }
      }
    }
  }
  return Array.from(buckets.entries()).map(([week, count]) => ({ week, count }))
}

export async function getDailyTransactions(): Promise<Array<{ date: string; count: number }>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('transactions')
    .select('transaction_date')
    .gte('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))

  const buckets = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    buckets.set(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 10), 0)
  }
  for (const row of data ?? []) {
    const key = row.transaction_date.slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
}

export async function getMonthlyVolume(): Promise<Array<{ month: string; volume: number; txCount: number }>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('transactions')
    .select('transaction_date, amount, currency, type')
    .gte('transaction_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))

  const buckets = new Map<string, { volume: number; txCount: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i, 1)
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 7)
    buckets.set(key, { volume: 0, txCount: 0 })
  }
  for (const row of data ?? []) {
    const key = row.transaction_date.slice(0, 7)
    if (buckets.has(key) && row.type === 'expense' && row.currency === 'MYR') {
      const b = buckets.get(key)!
      b.volume += row.amount
      b.txCount += 1
    }
  }
  return Array.from(buckets.entries()).map(([month, b]) => ({
    month,
    volume: Math.round(b.volume),
    txCount: b.txCount,
  }))
}

export async function getTopCategories(): Promise<Array<{ category: string; total: number; count: number }>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('transactions')
    .select('expense_category, amount')
    .eq('type', 'expense')
    .not('expense_category', 'is', null)

  const map = new Map<string, { total: number; count: number }>()
  for (const row of data ?? []) {
    const k = row.expense_category
    const e = map.get(k) ?? { total: 0, count: 0 }
    e.total += row.amount
    e.count += 1
    map.set(k, e)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([category, { total, count }]) => ({ category, total: Math.round(total), count }))
}

export async function getTopUsers(): Promise<Array<{ id: string; full_name: string | null; email: string; tx_count: number }>> {
  const supabase = createAdminClient()
  const { data: txData } = await supabase.from('transactions').select('user_id')

  const counts = new Map<string, number>()
  for (const row of txData ?? []) counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)

  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const ids = top.map(([id]) => id)

  const [{ data: profiles }, authData] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const emailMap = new Map<string, string>()
  for (const u of authData.data?.users ?? []) emailMap.set(u.id, u.email ?? '')
  const nameMap = new Map<string, string | null>()
  for (const p of profiles ?? []) nameMap.set(p.id, p.full_name)

  return top.map(([id, tx_count]) => ({
    id,
    full_name: nameMap.get(id) ?? null,
    email: emailMap.get(id) ?? '',
    tx_count,
  }))
}

export async function getUserGrowth(): Promise<Array<{ month: string; total: number }>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('created_at')
    .order('created_at')

  const buckets = new Map<string, number>()
  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 7)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  let cumulative = 0
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, total: (cumulative += count) }))
}
