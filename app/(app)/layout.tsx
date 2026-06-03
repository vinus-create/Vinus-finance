import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/layout/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_done')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_done) {
    redirect('/onboarding')
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <main className="flex-1 page-content overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
