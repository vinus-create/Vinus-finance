// Vinus Finance — Service Worker
// Handles Web Push Notifications

self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Vinus Finance', {
      body: data.body ?? '',
      icon: '/icons/apple-touch-icon.png',
      badge: '/icons/apple-touch-icon.png',
      tag: data.tag ?? 'reminder',
      requireInteraction: false,
      data: { url: data.url ?? '/reminders' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(event.notification.data.url)
          return client.focus()
        }
      }
      return clients.openWindow(event.notification.data.url)
    })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(clients.claim()))
