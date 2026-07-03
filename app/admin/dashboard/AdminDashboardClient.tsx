'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Users, TrendingUp, Calendar, Receipt, DollarSign, Bot, MessageCircle, TrendingDown, Activity } from 'lucide-react'
import type { AdminStats, ApiUsage } from '@/lib/admin/queries'

interface Props {
  stats: AdminStats
  weeklyUsers: Array<{ week: string; count: number }>
  dailyTxns: Array<{ date: string; count: number }>
  configs: Record<string, string>
  apiUsage: ApiUsage
}

function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string
  icon: React.ComponentType<{ className?: string }>; color: string
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboardClient({ stats, weeklyUsers, dailyTxns, configs, apiUsage }: Props) {
  const aiPct = stats.totalUsers > 0 ? Math.round((stats.aiParseUsers / stats.totalUsers) * 100) : 0
  const tgPct = stats.totalUsers > 0 ? Math.round((stats.telegramUsers / stats.totalUsers) * 100) : 0
  const stockPct = stats.totalUsers > 0 ? Math.round((stats.stockUsers / stats.totalUsers) * 100) : 0

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Total Users" value={stats.totalUsers.toLocaleString()} icon={Users} color="bg-blue-500" />
        <KpiCard title="Active (30d)" value={stats.activeUsersLast30d.toLocaleString()} sub="unique users with transactions" icon={TrendingUp} color="bg-emerald-500" />
        <KpiCard title="New This Month" value={stats.newUsersThisMonth.toLocaleString()} icon={Calendar} color="bg-violet-500" />
        <KpiCard title="Total Transactions" value={stats.totalTransactions.toLocaleString()} icon={Receipt} color="bg-orange-500" />
        <KpiCard
          title="Total Volume"
          value={`RM ${stats.totalVolumeMYR >= 1_000_000
            ? (stats.totalVolumeMYR / 1_000_000).toFixed(1) + 'M'
            : stats.totalVolumeMYR >= 1_000
            ? (stats.totalVolumeMYR / 1_000).toFixed(1) + 'K'
            : stats.totalVolumeMYR.toLocaleString()}`}
          sub="expense transactions (MYR)"
          icon={DollarSign}
          color="bg-rose-500"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">New Users per Week (12 weeks)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyUsers}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'New Users']} labelFormatter={l => `Week of ${l}`} />
              <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Daily Transactions (30 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyTxns}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} interval={4} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Transactions']} />
              <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gemini API usage monitor */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-violet-500" /> Gemini API Usage
          </h3>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Today</p>
              <p className="text-lg font-bold text-slate-900">{apiUsage.today.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">This Month</p>
              <p className="text-lg font-bold text-slate-900">{apiUsage.month.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={apiUsage.daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} interval={1} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip labelFormatter={l => `Day ${l}`} />
            <Bar dataKey="standard" name="Standard" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="hq" name="HQ" stackId="a" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Standard (text/PDF)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-500" /> HQ (voice/images)</span>
        </div>
      </div>

      {/* Feature adoption + AI model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Feature Adoption</h3>
          <div className="space-y-3">
            {[
              { label: 'AI Transaction Parse', pct: aiPct, icon: Bot, color: 'bg-violet-100 text-violet-600' },
              { label: 'Telegram Bot', pct: tgPct, icon: MessageCircle, color: 'bg-blue-100 text-blue-600' },
              { label: 'Stock Portfolio', pct: stockPct, icon: TrendingDown, color: 'bg-emerald-100 text-emerald-600' },
            ].map(({ label, pct, icon: Icon, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded flex items-center justify-center ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm text-slate-600">{label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Active AI Models</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Standard (text / PDF)</p>
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-mono font-medium px-3 py-1 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {configs.ai_model_standard ?? 'gemini-2.5-flash-lite'}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">HQ (voice / images)</p>
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-mono font-medium px-3 py-1 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {configs.ai_model_hq ?? 'gemini-2.5-flash'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">Change models in Settings → AI Configuration</p>
          </div>
        </div>
      </div>
    </div>
  )
}
