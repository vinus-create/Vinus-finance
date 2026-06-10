import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyAdminToken, ADMIN_COOKIE_NAME } from '@/lib/admin/auth'
import AdminSidebar from './AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token || !verifyAdminToken(token)) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
