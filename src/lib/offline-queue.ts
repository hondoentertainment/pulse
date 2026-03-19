import type { EnergyRating } from './types'

/**
 * Offline-First Pulse Queue with Background Sync
 *
 * Queues pulse submissions when offline and syncs when connectivity returns.
 * Uses localStorage as a simple persistence layer (IndexedDB in production).
 */

const QUEUE_KEY = 'pulse_offline_queue'
const SYNC_STATUS_KEY = 'pulse_queue_sync_status'

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

export interface QueueProcessOptions {
  onItemAttempt?: (pulse: QueuedPulse) => void
  onItemResult?: (pulse: QueuedPulse, success: boolean, elapsedMs: number) => void
  onBatchComplete?: (summary: { synced: number; failed: number; total: number; elapsedMs: number }) => void
}

export interface QueueSyncStatus {
  lastAttemptAt?: string
  lastSuccessAt?: string
  lastFailureAt?: string
  lastSyncedCount: number
  lastFailedCount: number
  lastBatchDurationMs?: number
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

export function getQueueRetryInfo(): { failedCount: number; nextRetryInMs: number | null } {
  const failedItems = getQueue()
    .filter(item => item.status === 'failed')
    .sort((left, right) => new Date(left.queuedAt).getTime() - new Date(right.queuedAt).getTime())

  if (failedItems.length === 0) {
    return { failedCount: 0, nextRetryInMs: null }
  }

  const nextCandidate = failedItems[0]
  const backoffMs = Math.min(30000, 1000 * Math.pow(2, nextCandidate.retryCount))
  const sinceQueuedMs = Date.now() - new Date(nextCandidate.queuedAt).getTime()
  return {
    failedCount: failedItems.length,
    nextRetryInMs: Math.max(0, backoffMs - sinceQueuedMs),
  }
}

/**
 * Clear the entire queue.
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY)
}

export function getLastQueueSyncStatus(): QueueSyncStatus {
  try {
    const raw = localStorage.getItem(SYNC_STATUS_KEY)
    if (!raw) return { lastSyncedCount: 0, lastFailedCount: 0 }
    const parsed = JSON.parse(raw) as QueueSyncStatus
    return {
      lastAttemptAt: parsed.lastAttemptAt,
      lastSuccessAt: parsed.lastSuccessAt,
      lastFailureAt: parsed.lastFailureAt,
      lastSyncedCount: parsed.lastSyncedCount ?? 0,
      lastFailedCount: parsed.lastFailedCount ?? 0,
      lastBatchDurationMs: parsed.lastBatchDurationMs,
    }
  } catch {
    return { lastSyncedCount: 0, lastFailedCount: 0 }
  }
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
      (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync?.register('sync-pulses').catch(() => {
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
  submitFn: (pulse: QueuedPulse) => Promise<boolean>,
  options?: QueueProcessOptions
): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 }

  const queue = getQueue()
  const pending = queue.filter(q => q.status === 'pending' || q.status === 'failed')
  let synced = 0
  let failed = 0
  const batchStart = Date.now()

  for (const item of pending) {
    // Exponential backoff for retried failures to reduce rapid retry loops.
    if (item.retryCount > 0) {
      const retryDelayMs = Math.min(30000, 1000 * Math.pow(2, item.retryCount))
      await wait(retryDelayMs)
    }

    options?.onItemAttempt?.(item)
    markSyncing(item.id)
    const attemptStart = Date.now()
    try {
      const success = await submitFn(item)
      if (success) {
        dequeuePulse(item.id)
        synced++
        options?.onItemResult?.(item, true, Date.now() - attemptStart)
      } else {
        markFailed(item.id)
        failed++
        options?.onItemResult?.(item, false, Date.now() - attemptStart)
      }
    } catch {
      markFailed(item.id)
      failed++
      options?.onItemResult?.(item, false, Date.now() - attemptStart)
    }
  }

  options?.onBatchComplete?.({
    synced,
    failed,
    total: pending.length,
    elapsedMs: Date.now() - batchStart,
  })

  const nowIso = new Date().toISOString()
  const currentStatus = getLastQueueSyncStatus()
  const nextStatus: QueueSyncStatus = {
    ...currentStatus,
    lastAttemptAt: nowIso,
    lastSyncedCount: synced,
    lastFailedCount: failed,
    lastBatchDurationMs: Date.now() - batchStart,
  }
  if (synced > 0) nextStatus.lastSuccessAt = nowIso
  if (failed > 0) nextStatus.lastFailureAt = nowIso
  localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(nextStatus))

  return { synced, failed }
}
