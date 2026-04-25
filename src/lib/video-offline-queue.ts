/**
 * Video-specific offline queue.
 *
 * Reuses the same connectivity/backoff primitives as `offline-queue.ts`
 * without widening the `QueuedPulse` shape (which is narrow by design — it
 * only holds the fields the pulse-creation endpoint needs).
 *
 * Storage layout mirrors the existing queue: a single localStorage key holds
 * a JSON array. When the user publishes a video while offline we push a
 * `VideoPublishJob`; the sync layer drains it when connectivity returns.
 */

import type { PublishVideoPulseInput } from '@/lib/video-client'
import { isOnline, requestBackgroundSync } from '@/lib/offline-queue'

const QUEUE_KEY = 'pulse_video_publish_queue'

export interface VideoPublishJob {
  /** Client-generated id for idempotency. */
  id: string
  /** Discriminator so the drainer can route entries. */
  type: 'video-publish'
  /** The publish payload the Edge Function expects. */
  payload: PublishVideoPulseInput
  /** Optional preview URL for offline rendering — never uploaded. */
  localPreviewUrl?: string
  queuedAt: string
  retryCount: number
  status: 'pending' | 'syncing' | 'failed'
}

function readQueue(): VideoPublishJob[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as VideoPublishJob[]) : []
  } catch {
    return []
  }
}

function writeQueue(queue: VideoPublishJob[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Storage full — drop failed items first, then any over-quota tail.
    const filtered = queue.filter((q) => q.status !== 'failed')
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered))
    } catch {
      /* give up — next attempt will retry */
    }
  }
}

export function enqueueVideoPublish(
  job: Omit<VideoPublishJob, 'queuedAt' | 'retryCount' | 'status' | 'type'>,
): VideoPublishJob {
  const queued: VideoPublishJob = {
    ...job,
    type: 'video-publish',
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  }
  const queue = readQueue()
  queue.push(queued)
  writeQueue(queue)
  requestBackgroundSync()
  return queued
}

export function getVideoQueue(): VideoPublishJob[] {
  return readQueue()
}

export function getPendingVideoPublishCount(): number {
  return readQueue().filter((q) => q.status === 'pending' || q.status === 'failed').length
}

export function dequeueVideoPublish(id: string): void {
  writeQueue(readQueue().filter((q) => q.id !== id))
}

export function markVideoPublishSyncing(id: string): void {
  writeQueue(
    readQueue().map((q) => (q.id === id ? { ...q, status: 'syncing' as const } : q)),
  )
}

export function markVideoPublishFailed(id: string): void {
  const updated = readQueue().map((q) =>
    q.id === id
      ? { ...q, status: 'failed' as const, retryCount: q.retryCount + 1 }
      : q,
  )
  // Drop items that have exceeded the retry ceiling so the queue doesn't
  // grow unboundedly.
  writeQueue(updated.filter((q) => q.retryCount <= 5))
}

export function clearVideoQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY)
  } catch {
    /* noop */
  }
}

/**
 * Drain the queue. The caller supplies the submit function; this module only
 * knows about local state. Pairs with `registerConnectivityListeners` in
 * `offline-queue.ts`.
 */
export async function processVideoQueue(
  submit: (job: VideoPublishJob) => Promise<boolean>,
): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 }

  const pending = readQueue().filter((q) => q.status === 'pending' || q.status === 'failed')
  let synced = 0
  let failed = 0

  for (const job of pending) {
    markVideoPublishSyncing(job.id)
    try {
      const ok = await submit(job)
      if (ok) {
        dequeueVideoPublish(job.id)
        synced++
      } else {
        markVideoPublishFailed(job.id)
        failed++
      }
    } catch {
      markVideoPublishFailed(job.id)
      failed++
    }
  }

  return { synced, failed }
}
