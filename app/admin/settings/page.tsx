import { getAllAppConfigs } from '@/lib/admin/config'
import AdminSettingsClient from './AdminSettingsClient'

export default async function AdminSettingsPage() {
  const configs = await getAllAppConfigs()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform configuration</p>
      </div>
      <AdminSettingsClient configs={configs} />
    </div>
  )
}
