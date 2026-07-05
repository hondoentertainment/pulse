import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── localStorage shim ──────────────────────────────────────────
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { for (const k of Object.keys(store)) delete store[k] },
  length: 0,
  key: () => null,
})

let online = true
const listeners: Record<string, Array<() => void>> = { online: [], offline: [] }
vi.stubGlobal('navigator', { get onLine() { return online } })
vi.stubGlobal('window', {
  addEventListener: (evt: string, cb: () => void) => { (listeners[evt] ??= []).push(cb) },
  removeEventListener: (evt: string, cb: () => void) => {
    listeners[evt] = (listeners[evt] ?? []).filter((l) => l !== cb)
  },
})

// Mock the Supabase upload so we control sync success/failure.
const uploadPulseToSupabase = vi.fn(async (..._a: unknown[]) => true)
vi.mock('@/lib/supabase-api', () => ({ uploadPulseToSupabase: (...a: unknown[]) => uploadPulseToSupabase(...a) }))
// Force backend-on so the sync hook is active.
vi.mock('@/lib/data', () => ({ USE_SUPABASE_BACKEND: true }))

import { enqueuePulse, getPendingCount, clearQueue, type QueuedPulse } from '@/lib/offline-queue'

// The hook's flush logic is pure enough to exercise directly by importing the
// module and driving connectivity events; we test the drain behaviour via the
// queue + a manual flush that mirrors usePulseSync's effect body.
import { processQueue, isOnline } from '@/lib/offline-queue'
import { uploadPulseToSupabase as realUpload } from '@/lib/supabase-api'

function makeQueued(id: string, withSnapshot = true): Parameters<typeof enqueuePulse>[0] {
  const base = {
    id,
    venueId: 'venue-1',
    energyRating: 'buzzing' as const,
    caption: 'test',
    photos: [],
    hashtags: [],
  }
  if (!withSnapshot) return base
  return {
    ...base,
    pulse: {
      id,
      userId: 'user-1',
      venueId: 'venue-1',
      photos: [],
      energyRating: 'buzzing',
      caption: 'test',
      hashtags: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      reactions: { fire: [], eyes: [], skull: [], lightning: [] },
      views: 0,
    },
  }
}

// Re-derive the resync fn the hook uses (kept in sync with use-pulse-sync.ts).
async function resync(item: QueuedPulse): Promise<boolean> {
  const pulse = item.pulse
  if (!pulse || !pulse.userId) return true
  return realUpload(pulse)
}

beforeEach(() => {
  clearQueue()
  online = true
  uploadPulseToSupabase.mockClear()
  uploadPulseToSupabase.mockResolvedValue(true)
})

describe('offline pulse sync drain', () => {
  it('persists a queued pulse snapshot to Supabase and dequeues it', async () => {
    enqueuePulse(makeQueued('p1'))
    expect(getPendingCount()).toBe(1)

    await processQueue(resync)

    expect(uploadPulseToSupabase).toHaveBeenCalledTimes(1)
    expect(getPendingCount()).toBe(0)
  })

  it('keeps the item queued when the upload fails', async () => {
    uploadPulseToSupabase.mockResolvedValue(false)
    enqueuePulse(makeQueued('p2'))

    await processQueue(resync)

    expect(getPendingCount()).toBe(1)
  })

  it('does not attempt sync while offline', async () => {
    enqueuePulse(makeQueued('p3'))
    online = false

    if (isOnline()) await processQueue(resync)

    expect(uploadPulseToSupabase).not.toHaveBeenCalled()
    expect(getPendingCount()).toBe(1)
  })

  it('drops a legacy entry with no captured user rather than wedging the queue', async () => {
    enqueuePulse(makeQueued('p4', false))

    await processQueue(resync)

    // resync returns true (unsyncable) → treated as done → dequeued
    expect(uploadPulseToSupabase).not.toHaveBeenCalled()
    expect(getPendingCount()).toBe(0)
  })
})
