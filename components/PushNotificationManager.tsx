'use client'

import { useEffect } from 'react'

// Registers the service worker on app load.
// Actual subscription happens in NotificationSettings (settings page).
export default function PushNotificationManager() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(err => console.warn('[SW] Registration failed:', err))
  }, [])

  return null
}
