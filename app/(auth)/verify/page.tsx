'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLang } from '@/lib/i18n/LanguageProvider'

export default function VerifyPage() {
  const { t } = useLang()

  return (
    <Card className="border-0 shadow-lg text-center">
      <CardHeader className="pb-4">
        <div className="text-5xl mb-2">📬</div>
        <CardTitle className="text-xl">{t.auth_verify_title}</CardTitle>
        <CardDescription>
          {t.auth_verify_desc}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t.auth_verify_spam}
        </p>
        <Link href="/login">
          <Button variant="outline" className="w-full h-12 text-base">
            {t.auth_back_login}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
