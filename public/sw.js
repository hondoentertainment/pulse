/**
 * Service Worker for Pulse — Offline-First with Background Sync
 *
 * Handles caching strategies, offline pulse queue, and background sync.
 */

const CACHE_NAME = 'pulse-cache-v1'
const STATIC_CACHE = 'pulse-static-v1'
const IMAGE_CACHE = 'pulse-images-v1'

const STATIC_ASSETS = [
  '/',
  '/index.html',
]

const CACHEABLE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

// Install: pre-cache shell
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) { return cache.addAll(STATIC_ASSETS) })
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME && key !== STATIC_CACHE && key !== IMAGE_CACHE })
          .map(function (key) { return caches.delete(key) })
      )
    })
  )
  self.clients.claim()
})

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url)

  // Cache-first for fonts and static
  if (CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached
        return fetch(event.request).then(function (response) {
          var clone = response.clone()
          caches.open(STATIC_CACHE).then(function (cache) { cache.put(event.request, clone) })
          return response
        })
      })
    )
    return
  }

  // Cache-first for images
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached
        return fetch(event.request).then(function (response) {
          if (response.ok) {
            var clone = response.clone()
            caches.open(IMAGE_CACHE).then(function (cache) { cache.put(event.request, clone) })
          }
          return response
        }).catch(function () { return new Response('', { status: 404 }) })
      })
    )
    return
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (event.request.method === 'GET' && response.ok) {
          var clone = response.clone()
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone) })
        }
        return response
      })
      .catch(function () { return caches.match(event.request).then(function (cached) { return cached || new Response('Offline', { status: 503 }) }) })
  )
})

// Background sync for offline pulse queue
self.addEventListener('sync', function (event) {
  if (event.tag === 'sync-pulses') {
    event.waitUntil(syncOfflinePulses())
  }
})

function syncOfflinePulses() {
  // In a real implementation, this would read from IndexedDB
  // and push pending pulses to the API
  return self.clients.matchAll().then(function (clients) {
    clients.forEach(function (client) {
      client.postMessage({ type: 'SYNC_COMPLETE', tag: 'sync-pulses' })
    })
  })
}

// Legacy SW. Production uses VitePWA generateSW + public/push-sw.js.
// Keep kind/tag/renotify aligned with src/lib/glance-push.ts.
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
    vibrate: [200, 100, 200],
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
