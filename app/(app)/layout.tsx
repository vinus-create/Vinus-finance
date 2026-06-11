import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/get-user'
import BottomNav from '@/components/layout/BottomNav'
import { FabProvider } from '@/lib/contexts/FabContext'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarding_done, is_suspended')
    .eq('id', user.id)
    .single()

  // If is_suspended column hasn't been added yet, the query above fails.
  // Fall back to fetching only onboarding_done so the app still works.
  let onboardingDone = profile?.onboarding_done
  if (profileError) {
    const { data: basic } = await supabase
      .from('profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .single()
    onboardingDone = basic?.onboarding_done
  }

  if (profile?.is_suspended) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-xl font-bold text-foreground mb-2">Account Suspended</h1>
          <p className="text-muted-foreground text-sm">Your account has been suspended. Please contact support for assistance.</p>
        </div>
      </div>
    )
  }

  if (!onboardingDone) {
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
