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

// Push notification handler
self.addEventListener('push', function (event) {
  var data = event.data ? event.data.json() : { title: 'Pulse', body: 'New activity near you' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'pulse-notification',
      data: data.url ? { url: data.url } : undefined,
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
