'use client'

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'

interface Props {
  growth: Array<{ month: string; total: number }>
  volume: Array<{ month: string; volume: number; txCount: number }>
  categories: Array<{ category: string; total: number; count: number }>
  topUsers: Array<{ id: string; full_name: string | null; email: string; tx_count: number }>
}

export default function AdminAnalyticsClient({ growth, volume, categories, topUsers }: Props) {
  const maxCatTotal = categories[0]?.total ?? 1

  return (
    <div className="space-y-5">
      {/* User growth */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Cumulative User Growth</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={growth}>
            <defs>
              <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [v, 'Total Users']} />
            <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#userGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly volume */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Expense Volume (MYR)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={volume}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
            <Tooltip formatter={(v, name) => [name === 'volume' ? `RM ${Number(v).toLocaleString()}` : v, name === 'volume' ? 'Volume' : 'Transactions']} />
            <Bar dataKey="volume" fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top categories */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Expense Categories (all users)</h3>
          <div className="space-y-2.5">
            {categories.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No data yet</p>}
            {categories.map(({ category, total, count }) => (
              <div key={category}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="capitalize text-slate-700 font-medium">{category.replace(/_/g, ' ')}</span>
                  <span className="text-slate-400 font-mono">RM {total.toLocaleString()} · {count} txns</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(total / maxCatTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top users */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">Top 10 Most Active Users</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">User</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topUsers.length === 0 && (
                <tr><td colSpan={2} className="text-center py-8 text-slate-400 text-xs">No data yet</td></tr>
              )}
              {topUsers.map((u, i) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                      <div>
                        <p className="font-medium text-slate-900 text-xs">{u.full_name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-700">{u.tx_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
