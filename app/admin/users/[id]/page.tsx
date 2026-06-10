import { getUserDetail } from '@/lib/admin/queries'
import { notFound } from 'next/navigation'
import UserDetailClient from './UserDetailClient'

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUserDetail(id)
  if (!user) notFound()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{user.full_name ?? 'Unknown User'}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{user.email}</p>
      </div>
      <UserDetailClient user={user} />
    </div>
  )
}
