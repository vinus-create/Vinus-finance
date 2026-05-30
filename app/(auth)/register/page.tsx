'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLang } from '@/lib/i18n/LanguageProvider'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLang()

  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error(t.auth_pw_min_error)
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (error) {
      toast.error(error.message)
    } else {
      router.push('/verify')
    }
    setLoading(false)
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{t.auth_register_title}</CardTitle>
        <CardDescription>{t.auth_register_desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">{t.auth_fullname}</Label>
            <Input
              id="full-name"
              type="text"
              placeholder="Ahmad bin Ali"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t.auth_email}</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.auth_password}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t.auth_pw_placeholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-12 text-base"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700"
            disabled={loading}
          >
            {loading ? t.auth_registering : t.auth_register_btn}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {t.auth_has_account}{' '}
          <Link href="/login" className="font-medium text-emerald-600 underline-offset-4 hover:underline">
            {t.auth_login_link}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
