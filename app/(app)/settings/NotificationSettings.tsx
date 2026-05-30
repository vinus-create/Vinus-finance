'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/lib/i18n/LanguageProvider'

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}

export default function NotificationSettings() {
  const { t } = useLang()
  const [pushState, setPushState] = useState<PushState>('loading')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported'); return
    }
    if (Notification.permission === 'denied') {
      setPushState('denied'); return
    }
    navigator.serviceWorker.ready.then(async reg => {
      const sub = await reg.pushManager.getSubscription()
      setPushState(sub ? 'subscribed' : 'unsubscribed')
    })
  }, [])

  async function enablePush() {
    if (!VAPID_PUBLIC_KEY) {
      alert('NEXT_PUBLIC_VAPID_PUBLIC_KEY not set in .env.local'); return
    }
    setWorking(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setPushState('denied'); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      setPushState('subscribed')
    } catch (err) {
      console.error('[Push] Subscribe failed:', err)
    } finally {
      setWorking(false)
    }
  }

  async function disablePush() {
    setWorking(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushState('unsubscribed')
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err)
    } finally {
      setWorking(false)
    }
  }

  const statusConfig: Record<PushState, { badge: string; color: string; desc: string }> = {
    loading:      { badge: '…',    color: 'text-muted-foreground', desc: '' },
    unsupported:  { badge: t.notify_unsupported,  color: 'text-muted-foreground', desc: t.notify_unsupported_desc },
    denied:       { badge: t.notify_denied,        color: 'text-red-500',          desc: t.notify_denied_desc },
    subscribed:   { badge: t.notify_enabled,       color: 'text-emerald-600',      desc: t.notify_enabled_desc },
    unsubscribed: { badge: t.notify_disabled,      color: 'text-muted-foreground', desc: t.notify_disabled_desc },
  }

  const cfg = statusConfig[pushState]

  return (
    <div className="space-y-4">
      {/* Push Notification */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <p className="text-sm font-medium">{t.settings_push_title}</p>
            {pushState !== 'loading' && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted ${cfg.color}`}>
                {cfg.badge}
              </span>
            )}
          </div>
          {cfg.desc && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">{cfg.desc}</p>
          )}
        </div>

        {pushState === 'subscribed' && (
          <button
            onClick={disablePush}
            disabled={working}
            className="ml-3 shrink-0 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            {working ? '…' : t.notify_disable_btn}
          </button>
        )}
        {pushState === 'unsubscribed' && (
          <button
            onClick={enablePush}
            disabled={working}
            className="ml-3 shrink-0 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium"
          >
            {working ? '…' : t.notify_enable_btn}
          </button>
        )}
      </div>

      {/* Email — shows configured email */}
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5">📧</span>
        <div>
          <p className="text-sm font-medium">{t.settings_email_title}</p>
          <p className="text-xs text-muted-foreground">{t.settings_email_desc}</p>
        </div>
      </div>
    </div>
  )
}
