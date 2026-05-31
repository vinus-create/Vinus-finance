'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  initialName: string | null
  initialPhone: string | null
  email: string
}

export default function EditProfileCard({ initialName, initialPhone, email }: Props) {
  const { t } = useLang()
  const [name, setName] = useState(initialName ?? '')
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Session expired')
      const { error: err } = await supabase
        .from('profiles')
        .update({ full_name: name || null, phone_number: phone || null, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (err) throw new Error(err.message)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4 pb-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t.settings_edit_profile}
        </p>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t.settings_name}</p>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full name"
            className="h-9 text-sm"
          />
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t.settings_email}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t.settings_phone_number}</p>
          <Input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder={t.settings_phone_placeholder}
            className="h-9 text-sm"
            inputMode="tel"
          />
          <p className="text-[10px] text-muted-foreground">{t.settings_whatsapp_hint}</p>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <Button
          className="w-full h-9 bg-emerald-500 text-white hover:bg-emerald-600 text-sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? t.settings_profile_saved : saving ? '…' : t.settings_save_profile}
        </Button>
      </CardContent>
    </Card>
  )
}
