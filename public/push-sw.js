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
      postUrl: typeof extra.postUrl === 'string' ? extra.postUrl : null,
      openUrl: typeof extra.openUrl === 'string' ? extra.openUrl : null,
      muteUrl: typeof extra.muteUrl === 'string' ? extra.muteUrl : null,
    },
  }
  if (Array.isArray(payload.actions) && payload.actions.length > 0) {
    options.actions = payload.actions.slice(0, 3).filter(function (action) {
      return action && typeof action.action === 'string' && typeof action.title === 'string'
    })
  }
  if (extra.renotify === true) options.renotify = true
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var data = event.notification.data || {}
  var url = data.url || '/'
  if (event.action === 'post' && data.postUrl) url = data.postUrl
  else if (event.action === 'open' && data.openUrl) url = data.openUrl
  else if (event.action === 'mute' && data.muteUrl) url = data.muteUrl
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function (clients) {
      var existing = clients.find(function (c) { return c.url.indexOf(url) !== -1 && 'focus' in c })
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
