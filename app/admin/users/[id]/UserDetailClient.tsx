'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ShieldOff, ShieldCheck, Phone, MapPin, Calendar, Receipt, CreditCard, Landmark, Target } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminUserDetail } from '@/lib/admin/queries'

export default function UserDetailClient({ user: initial }: { user: AdminUserDetail }) {
  const [user, setUser] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function toggleSuspend() {
    setLoading(true)
    const next = !user.is_suspended
    const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspend: next }),
    })
    setLoading(false)
    if (!res.ok) { toast.error('Failed to update status'); return }
    setUser(u => ({ ...u, is_suspended: next }))
    toast.success(next ? 'User suspended' : 'User unsuspended')
  }

  const formatMYR = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ChevronLeft className="w-4 h-4" /> Back to Users
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xl flex items-center justify-center shrink-0">
              {(user.full_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{user.full_name ?? '—'}</h2>
              <p className="text-sm text-slate-500">{user.email}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                {user.phone_number && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone_number}</span>}
                {user.state && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{user.state}</span>}
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {new Date(user.created_at).toLocaleDateString()}</span>
                <span className={`flex items-center gap-1 font-medium ${user.onboarding_done ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {user.onboarding_done ? '✓ Onboarded' : '⏳ Onboarding pending'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.is_suspended ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {user.is_suspended ? 'Suspended' : 'Active'}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          {[
            { label: 'Transactions', value: user.tx_count, icon: Receipt },
            { label: 'Accounts', value: user.account_count, icon: CreditCard },
            { label: 'Loans', value: user.loan_count, icon: Landmark },
            { label: 'Savings Goals', value: user.goal_count, icon: Target },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center">
              <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Financial snapshot */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Income', value: formatMYR(user.total_income), color: 'text-emerald-600' },
          { label: 'Total Expense', value: formatMYR(user.total_expense), color: 'text-red-500' },
          { label: 'Net Worth', value: formatMYR(user.net_worth), color: user.net_worth >= 0 ? 'text-blue-600' : 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">Recent Transactions (last 20)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Date</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Description</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Category</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {user.recent_transactions.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-xs">No transactions</td></tr>
              )}
              {user.recent_transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{tx.transaction_date}</td>
                  <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate">{tx.description || tx.merchant_name || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-400 capitalize text-xs">{tx.expense_category ?? tx.income_category ?? tx.type}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-medium ${tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-red-500' : 'text-slate-600'}`}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}RM {tx.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-5">
        <h3 className="text-sm font-semibold text-red-700 mb-3">Danger Zone</h3>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{user.is_suspended ? 'Unsuspend Account' : 'Suspend Account'}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {user.is_suspended
                ? 'Restore access to this account'
                : 'Block this user from logging in. Revokes active sessions.'}
            </p>
          </div>
          <button
            onClick={toggleSuspend}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
              user.is_suspended
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {user.is_suspended
              ? <><ShieldCheck className="w-4 h-4" />Unsuspend</>
              : <><ShieldOff className="w-4 h-4" />Suspend User</>}
          </button>
        </div>
      </div>
    </div>
  )
}
