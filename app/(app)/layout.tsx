import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import BottomNav from '@/components/layout/BottomNav'
import { FabProvider } from '@/lib/contexts/FabContext'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_done')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_done) {
    redirect('/onboarding')
  }

  return (
    <FabProvider>
      <div className="flex flex-col min-h-[100dvh] bg-background">
        <main className="flex-1 page-content overflow-y-auto">
          {children}
        </main>
        <BottomNav />
      </div>
    </FabProvider>
  )
}
