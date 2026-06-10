import { getAdminStats, getNewUsersPerWeek, getDailyTransactions } from '@/lib/admin/queries'
import { getAllAppConfigs } from '@/lib/admin/config'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminDashboardPage() {
  const [stats, weeklyUsers, dailyTxns, configs] = await Promise.all([
    getAdminStats(),
    getNewUsersPerWeek(),
    getDailyTransactions(),
    getAllAppConfigs(),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform overview — real-time data</p>
      </div>
      <AdminDashboardClient
        stats={stats}
        weeklyUsers={weeklyUsers}
        dailyTxns={dailyTxns}
        configs={configs}
      />
    </div>
  )
}
