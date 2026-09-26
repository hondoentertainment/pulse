/**
 * Web Push handlers imported by VitePWA generateSW.
 * Keep field names aligned with src/lib/glance-push.ts (kind, tag, renotify, url).
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
  var tag = (typeof extra.tag === 'string' && extra.tag)
    || (typeof extra.kind === 'string' && extra.kind)
    || 'pulse-notification'
  var options = {
    body: body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: tag,
    data: {
      url: url,
      kind: typeof extra.kind === 'string' ? extra.kind : null,
      tag: tag,
    },
  }
  if (extra.renotify === true) options.renotify = true
  event.waitUntil(self.registration.showNotification(title, options))
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
