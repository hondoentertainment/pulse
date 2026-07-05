import { useEffect } from 'react'
import {
  isOnline,
  processQueue,
  registerConnectivityListeners,
  getPendingCount,
  type QueuedPulse,
} from '@/lib/offline-queue'
import { uploadPulseToSupabase } from '@/lib/supabase-api'
import { USE_SUPABASE_BACKEND } from '@/lib/data'
import type { Pulse } from '@/lib/types'

/**
 * Reconstruct a persistable Pulse from a queued item. Prefers the full snapshot
 * captured at enqueue time; falls back to the flat display fields for any legacy
 * queue entry that predates the snapshot.
 */
function toPulse(item: QueuedPulse): Pulse {
  if (item.pulse) return item.pulse
  const now = item.queuedAt
  return {
    id: item.id,
    userId: '',
    venueId: item.venueId,
    photos: item.photos,
    energyRating: item.energyRating,
    caption: item.caption,
    hashtags: item.hashtags ?? [],
    createdAt: now,
    expiresAt: new Date(new Date(now).getTime() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
  }
}

async function resyncQueuedPulse(item: QueuedPulse): Promise<boolean> {
  const pulse = toPulse(item)
  // A legacy entry with no captured userId can't satisfy the RLS insert policy;
  // treat it as permanently unsyncable so it doesn't wedge the queue.
  if (!pulse.userId) return true
  return uploadPulseToSupabase(pulse)
}

/**
 * Drains the offline pulse queue to Supabase on mount and whenever
 * connectivity is restored. Wired into the venue app shell. No-op unless the
 * Supabase backend is active (in mock mode there is nothing to sync to).
 */
export function usePulseSync(): void {
  useEffect(() => {
    if (!USE_SUPABASE_BACKEND) return

    let running = false
    const flush = () => {
      if (running || !isOnline() || getPendingCount() === 0) return
      running = true
      void processQueue(resyncQueuedPulse).finally(() => {
        running = false
      })
    }

    flush()
    return registerConnectivityListeners(flush, () => {})
  }, [])
}
