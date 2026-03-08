import type { Pulse, EnergyRating } from './types'

/**
 * Offline-First Pulse Queue with Background Sync
 *
 * Queues pulse submissions when offline and syncs when connectivity returns.
 * Uses localStorage as a simple persistence layer (IndexedDB in production).
 */

const QUEUE_KEY = 'pulse_offline_queue'

export interface QueuedPulse {
  id: string
  venueId: string
  energyRating: EnergyRating
  caption?: string
  photos: string[]
  hashtags?: string[]
  queuedAt: string
  retryCount: number
  status: 'pending' | 'syncing' | 'failed'
}

/**
 * Add a pulse to the offline queue.
 */
export function enqueuePulse(pulse: Omit<QueuedPulse, 'queuedAt' | 'retryCount' | 'status'>): QueuedPulse {
  const queued: QueuedPulse = {
    ...pulse,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  }
  const queue = getQueue()
  queue.push(queued)
  saveQueue(queue)
  requestBackgroundSync()
  return queued
}

/**
 * Get all queued pulses.
 */
export function getQueue(): QueuedPulse[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Save queue to storage.
 */
function saveQueue(queue: QueuedPulse[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Storage full — drop oldest failed items
    const filtered = queue.filter(q => q.status !== 'failed')
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered))
  }
}

/**
 * Remove a pulse from the queue after successful sync.
 */
export function dequeuePulse(id: string): void {
  const queue = getQueue().filter(q => q.id !== id)
  saveQueue(queue)
}

/**
 * Mark a queued pulse as syncing.
 */
export function markSyncing(id: string): void {
  const queue = getQueue().map(q =>
    q.id === id ? { ...q, status: 'syncing' as const } : q
  )
  saveQueue(queue)
}

/**
 * Mark a queued pulse as failed and increment retry count.
 */
export function markFailed(id: string): void {
  const queue = getQueue().map(q =>
    q.id === id ? { ...q, status: 'failed' as const, retryCount: q.retryCount + 1 } : q
  )
  // Drop items that have failed too many times
  saveQueue(queue.filter(q => q.retryCount <= 5))
}

/**
 * Get count of pending items in the queue.
 */
export function getPendingCount(): number {
  return getQueue().filter(q => q.status === 'pending' || q.status === 'failed').length
}

/**
 * Clear the entire queue.
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY)
}

/**
 * Check if the browser is online.
 */
export function isOnline(): boolean {
  return navigator.onLine
}

/**
 * Request background sync if available.
 */
export function requestBackgroundSync(): void {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(reg => {
      (reg as any).sync?.register('sync-pulses').catch(() => {
        // Background sync not available, will sync on next online event
      })
    })
  }
}

/**
 * Register online/offline event listeners.
 * Returns a cleanup function.
 */
export function registerConnectivityListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

/**
 * Process the offline queue — attempt to sync all pending items.
 * Takes a submit function that handles the actual API call.
 */
export async function processQueue(
  submitFn: (pulse: QueuedPulse) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 }

  const queue = getQueue()
  const pending = queue.filter(q => q.status === 'pending' || q.status === 'failed')
  let synced = 0
  let failed = 0

  for (const item of pending) {
    markSyncing(item.id)
    try {
      const success = await submitFn(item)
      if (success) {
        dequeuePulse(item.id)
        synced++
      } else {
        markFailed(item.id)
        failed++
      }
    } catch {
      markFailed(item.id)
      failed++
    }
  }

  return { synced, failed }
}
