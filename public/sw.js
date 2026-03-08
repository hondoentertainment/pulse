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
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  )
  ;(self as any).skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== STATIC_CACHE && key !== IMAGE_CACHE)
          .map(key => caches.delete(key))
      )
    )
  )
  ;(self as any).clients.claim()
})

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url)

  // Cache-first for fonts and static
  if (CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone))
          return response
        })
      })
    )
    return
  }

  // Cache-first for images
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(IMAGE_CACHE).then(cache => cache.put(event.request, clone))
          }
          return response
        }).catch(() => new Response('', { status: 404 }))
      })
    )
    return
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (event.request.method === 'GET' && response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then(cached => cached || new Response('Offline', { status: 503 })))
  )
})

// Background sync for offline pulse queue
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-pulses') {
    event.waitUntil(syncOfflinePulses())
  }
})

async function syncOfflinePulses() {
  // In a real implementation, this would read from IndexedDB
  // and push pending pulses to the API
  const clients = await (self as any).clients.matchAll()
  clients.forEach((client: any) => {
    client.postMessage({ type: 'SYNC_COMPLETE', tag: 'sync-pulses' })
  })
}

// Push notification handler
self.addEventListener('push', (event: any) => {
  const data = event.data?.json() ?? { title: 'Pulse', body: 'New activity near you' }
  event.waitUntil(
    (self as any).registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [200, 100, 200],
      tag: data.tag ?? 'pulse-notification',
      data: data.url ? { url: data.url } : undefined,
    })
  )
})

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window' }).then((clients: any[]) => {
      const existing = clients.find((c: any) => c.url === url && 'focus' in c)
      if (existing) return existing.focus()
      return (self as any).clients.openWindow(url)
    })
  )
})

export {}
