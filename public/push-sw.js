/**
 * Web Push handlers imported by VitePWA generateSW and public/sw.js.
 * Title/body/url come from the live-pulse notify payload.
 */
self.addEventListener('push', function (event) {
  var payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (_err) {
    payload = {}
  }
  var title = payload.title || 'Pulse'
  var body = payload.body || 'See where the energy is right now.'
  var extra = payload.data || {}
  var url = (typeof extra.url === 'string' && extra.url.charAt(0) === '/')
    ? extra.url
    : '/'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
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
      var existing = clients.find(function (c) { return c.url.indexOf(url) !== -1 && 'focus' in c })
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
