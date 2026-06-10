'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight, Eye, ShieldOff, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminUser } from '@/lib/admin/queries'

interface Props {
  users: AdminUser[]
  total: number
  page: number
  q: string
  status: string
}

function Avatar({ name }: { name: string | null }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
      {initials}
    </div>
  )
}

export default function AdminUsersClient({ users: initialUsers, total, page, q, status }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState(q)
  const [isPending, startTransition] = useTransition()
  const pageSize = 25
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams({ q: search, page: String(page), status, ...params })
    router.push(`/admin/users?${sp.toString()}`)
  }

  async function toggleSuspend(user: AdminUser) {
    const next = !user.is_suspended
    const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspend: next }),
    })
    if (!res.ok) { toast.error('Failed to update user'); return }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_suspended: next } : u))
    toast.success(next ? `${user.full_name ?? user.email} suspended` : `${user.full_name ?? user.email} unsuspended`)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate({ q: search, page: '1' })}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'suspended'].map(s => (
            <button
              key={s}
              onClick={() => navigate({ status: s, page: '1' })}
              className={`px-3 py-2 text-sm rounded-lg font-medium capitalize transition-colors ${
                status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => navigate({ q: search, page: '1' })}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          Search
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-10">#</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Joined</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Txns</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">No users found</td>
                </tr>
              )}
              {users.map((user, i) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={user.full_name} />
                      <span className="font-medium text-slate-900">{user.full_name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{user.email}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{user.tx_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.is_suspended
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {user.is_suspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => startTransition(() => { toggleSuspend(user) })}
                        disabled={isPending}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.is_suspended
                            ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={user.is_suspended ? 'Unsuspend' : 'Suspend'}
                      >
                        {user.is_suspended ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} — {total} users
            </p>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => navigate({ page: String(page + 1) })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
