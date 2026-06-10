import { getAllUsers } from '@/lib/admin/queries'
import AdminUsersClient from './AdminUsersClient'

interface SearchParams { q?: string; page?: string; status?: string }

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const q = sp.q ?? ''
  const page = Math.max(1, parseInt(sp.page ?? '1'))
  const status = sp.status ?? 'all'

  const { users, total } = await getAllUsers(page, q, status)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-slate-500 text-sm mt-0.5">{total.toLocaleString()} registered users</p>
      </div>
      <AdminUsersClient users={users} total={total} page={page} q={q} status={status} />
    </div>
  )
}
