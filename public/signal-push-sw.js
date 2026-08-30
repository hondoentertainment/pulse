/* Closed-app Signal reminder handlers. Imported by the generated Workbox SW. */
self.addEventListener('push', function (event) {
  var payload = event.data ? event.data.json() : {}
  var title = payload.title || 'Pulse Signal'
  var body = payload.body || 'Take 10 seconds to log today’s signal.'
  var extra = payload.data || {}
  var url = (typeof extra.url === 'string' && extra.url.charAt(0) === '/')
    ? extra.url
    : extra.kind === 'signal_reminder' ? '/home' : '/'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [200, 100, 200],
      tag: extra.tag || extra.kind || 'pulse-notification',
      data: { url: url, kind: extra.kind || null },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function (clients) {
      var existing = clients.find(function (c) { return c.url === url && 'focus' in c })
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
