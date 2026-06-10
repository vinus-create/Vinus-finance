import { getUserGrowth, getMonthlyVolume, getTopCategories, getTopUsers } from '@/lib/admin/queries'
import AdminAnalyticsClient from './AdminAnalyticsClient'

export default async function AdminAnalyticsPage() {
  const [growth, volume, categories, topUsers] = await Promise.all([
    getUserGrowth(),
    getMonthlyVolume(),
    getTopCategories(),
    getTopUsers(),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform-wide statistics</p>
      </div>
      <AdminAnalyticsClient growth={growth} volume={volume} categories={categories} topUsers={topUsers} />
    </div>
  )
}
