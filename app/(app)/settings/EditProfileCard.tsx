'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Props {
  initialName: string | null
  initialPhone: string | null
  initialTelegramId: string | null   // numeric string or null
  initialDob: string | null
  email: string
}

export default function EditProfileCard({ initialName, initialPhone, initialTelegramId, initialDob, email }: Props) {
  const { t } = useLang()
  const router = useRouter()

  // Profile fields
  const [name, setName] = useState(initialName ?? '')
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [dob, setDob] = useState(initialDob ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Telegram connect state
  const [tgLinked, setTgLinked] = useState(!!initialTelegramId)
  const [tgLoading, setTgLoading] = useState(false)
  const [tgWaiting, setTgWaiting] = useState(false)   // after opening Telegram, waiting for user to return
  const [tgError, setTgError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setSaved(false); setProfileError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Session expired')
      const { error: err } = await supabase.from('profiles').update({
        full_name: name || null,
        phone_number: phone || null,
        date_of_birth: dob || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
      if (err) throw new Error(err.message)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false) }
  }

  async function handleConnectTelegram() {
    setTgLoading(true); setTgError(null)
    try {
      const res = await fetch('/api/telegram/generate-link', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.deepLink) throw new Error(data.error ?? 'Failed to generate link')
      // Open Telegram with the pre-filled deep link
      window.open(data.deepLink, '_blank')
      setTgWaiting(true)
    } catch (e) {
      setTgError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setTgLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('解除 Telegram 绑定？')) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ telegram_id: null }).eq('id', user.id)
    setTgLinked(false)
    setTgWaiting(false)
  }

  async function checkConnection() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('telegram_id').eq('id', user.id).single()
    if ((data as { telegram_id?: number | null })?.telegram_id) {
      setTgLinked(true)
      setTgWaiting(false)
      router.refresh()
    } else {
      setTgError('还没绑定成功，请先在 Telegram 点击 START')
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
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="h-9 text-sm" />
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t.settings_email}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t.settings_phone_number}</p>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t.settings_phone_placeholder}
            className="h-9 text-sm" inputMode="tel" />
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">🎂 出生日期</p>
          <Input type="date" value={dob} onChange={e => setDob(e.target.value)} className="h-9 text-sm" />
          <p className="text-[10px] text-muted-foreground">用于存钱目标「届时年龄」计算</p>
        </div>

        {profileError && <p className="text-xs text-red-500">{profileError}</p>}

        <Button className="w-full h-9 bg-emerald-500 text-white hover:bg-emerald-600 text-sm"
          onClick={handleSave} disabled={saving}>
          {saved ? t.settings_profile_saved : saving ? '…' : t.settings_save_profile}
        </Button>

        <Separator />

        {/* ── Telegram Connect Section ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Telegram 机器人</p>
            {tgLinked && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
                ✅ 已连接
              </span>
            )}
          </div>

          {tgLinked ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <span className="text-2xl">🤖</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">已绑定 @VinusFinanceBot</p>
                  <p className="text-[10px] text-muted-foreground">发送收据/文字/语音到 Telegram 自动记账</p>
                </div>
              </div>
              <button onClick={handleDisconnect}
                className="text-xs text-red-500 hover:text-red-700 transition-colors w-full text-center py-1">
                解除绑定
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-1">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">绑定后可以：</p>
                <p className="text-[10px] text-muted-foreground">📝 发文字 → 自动记账（rm15 nasi lemak）</p>
                <p className="text-[10px] text-muted-foreground">📸 发收据照片 → AI 识别记账</p>
                <p className="text-[10px] text-muted-foreground">🎤 发语音 → 语音记账</p>
                <p className="text-[10px] text-muted-foreground">/report → 查看本周消费报告</p>
              </div>

              {tgWaiting ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <span className="text-base animate-bounce">⏳</span>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      请在 Telegram 中点击 <strong>START</strong>，然后回来刷新状态
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-8"
                      onClick={() => window.open('https://t.me/VinusFinanceBot', '_blank')}>
                      重新打开 Telegram
                    </Button>
                    <Button size="sm" className="text-xs h-8 bg-emerald-500 text-white hover:bg-emerald-600"
                      onClick={checkConnection}>
                      ✓ 检查是否绑定
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="w-full h-10 bg-blue-500 hover:bg-blue-600 text-white font-medium"
                  onClick={handleConnectTelegram}
                  disabled={tgLoading}
                >
                  {tgLoading
                    ? '⏳ 生成链接中...'
                    : '🔗 一键绑定 Telegram'}
                </Button>
              )}

              {tgError && <p className="text-xs text-red-500">{tgError}</p>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
