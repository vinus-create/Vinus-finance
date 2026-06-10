'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, BarChart2, Settings, LogOut, Zap } from 'lucide-react'

const NAV = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="w-60 min-h-screen bg-slate-900 text-slate-100 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-white text-base">Vinus Admin</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Control Panel</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Logout
        </button>
        <p className="text-xs text-slate-600 text-center mt-2">Logged in as ADMIN</p>
      </div>
    </aside>
  )
}
