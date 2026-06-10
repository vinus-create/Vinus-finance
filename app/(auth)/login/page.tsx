'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLang } from '@/lib/i18n/LanguageProvider'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLang()

  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Admin intercept — ADMIN username bypasses Supabase
    if (email.trim().toUpperCase() === 'ADMIN') {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim(), password }),
      })
      if (res.ok) {
        router.push('/admin/dashboard')
      } else {
        toast.error('Invalid admin credentials')
      }
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
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
        <CardTitle className="text-xl">{t.auth_login_title}</CardTitle>
        <CardDescription>{t.auth_login_desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="password">
          <TabsList className="grid grid-cols-2 w-full mb-6">
            <TabsTrigger value="password">{t.auth_password_tab}</TabsTrigger>
            <TabsTrigger value="magic">Magic Link</TabsTrigger>
          </TabsList>

          {/* Email + Password */}
          <TabsContent value="password">
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-pw">{t.auth_email}</Label>
                <Input
                  id="email-pw"
                  type="text"
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 text-base"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700"
                disabled={loading}
              >
                {loading ? t.auth_logging_in : t.auth_login_btn}
              </Button>
            </form>
          </TabsContent>

          {/* Magic Link */}
          <TabsContent value="magic">
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-magic">{t.auth_email}</Label>
                <Input
                  id="email-magic"
                  type="email"
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 text-base"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {t.auth_magic_hint}
              </p>
              <Button
                type="submit"
                className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700"
                disabled={loading}
              >
                {loading ? t.auth_sending : t.auth_send_magic}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {t.auth_no_account}{' '}
          <Link href="/register" className="font-medium text-emerald-600 underline-offset-4 hover:underline">
            {t.auth_register_link}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
