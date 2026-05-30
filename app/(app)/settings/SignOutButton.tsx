'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useLang } from '@/lib/i18n/LanguageProvider'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLang()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <Button
      variant="destructive"
      className="w-full h-12 text-base"
      onClick={handleSignOut}
    >
      <LogOut className="w-4 h-4 mr-2" />
      {t.settings_signout}
    </Button>
  )
}
