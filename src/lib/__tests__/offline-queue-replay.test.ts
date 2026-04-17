import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  enqueuePulse,
  getQueue,
  clearQueue,
  processQueue,
  getPendingCount,
  getQueueRetryInfo,
  registerConnectivityListeners,
  isOnline,
} from '../offline-queue'

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

// ── navigator.onLine mutable ───────────────────────────────────
let online = true
vi.stubGlobal('navigator', {
  get onLine() { return online },
})

beforeEach(() => {
  clearQueue()
  online = true
})

describe('offline queue — enqueue on network failure', () => {
  it('items added while offline persist until replay', () => {
    online = false
    enqueuePulse({ id: 'offline-1', venueId: 'v-1', energyRating: 'buzzing', photos: [] })
    expect(getQueue().length).toBe(1)
    expect(getPendingCount()).toBe(1)
  })

  it('processQueue is a no-op while offline', async () => {
    enqueuePulse({ id: 'p-x', venueId: 'v-1', energyRating: 'chill', photos: [] })
    online = false
    const submit = vi.fn()
    const result = await processQueue(submit as any)
    expect(submit).not.toHaveBeenCalled()
    expect(result).toEqual({ synced: 0, failed: 0 })
    expect(getQueue().length).toBe(1)
  })
})

describe('offline queue — replay on reconnect', () => {
  it('replays all pending items and removes them from the queue', async () => {
    enqueuePulse({ id: 'r-1', venueId: 'v-1', energyRating: 'electric', photos: [] })
    enqueuePulse({ id: 'r-2', venueId: 'v-2', energyRating: 'buzzing', photos: [] })
    enqueuePulse({ id: 'r-3', venueId: 'v-3', energyRating: 'chill', photos: [] })

    const seen: string[] = []
    const submit = async (pulse: any) => {
      seen.push(pulse.id)
      return true
    }

    const result = await processQueue(submit as any)
    expect(result.synced).toBe(3)
    expect(result.failed).toBe(0)
    expect(seen).toEqual(['r-1', 'r-2', 'r-3'])
    expect(getQueue().length).toBe(0)
  })

  it('keeps failed items in the queue for retry', async () => {
    enqueuePulse({ id: 'fail-1', venueId: 'v-1', energyRating: 'chill', photos: [] })
    enqueuePulse({ id: 'ok-1', venueId: 'v-2', energyRating: 'buzzing', photos: [] })

    const submit = async (pulse: any) => pulse.id === 'ok-1'

    const result = await processQueue(submit as any)
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(1)
    const queue = getQueue()
    expect(queue.length).toBe(1)
    expect(queue[0].id).toBe('fail-1')
    expect(queue[0].status).toBe('failed')
  })
})

describe('offline queue — dedupe', () => {
  it('does not add duplicate IDs when processQueue is invoked twice with success', async () => {
    enqueuePulse({ id: 'dup-1', venueId: 'v-1', energyRating: 'chill', photos: [] })
    await processQueue(async () => true)
    // Running again should be a no-op (already drained)
    const result = await processQueue(async () => true)
    expect(result.synced).toBe(0)
    expect(getQueue().length).toBe(0)
  })

  it('retry info reports expected failed count and backoff', async () => {
    enqueuePulse({ id: 'x-1', venueId: 'v-1', energyRating: 'chill', photos: [] })
    await processQueue(async () => false)
    const info = getQueueRetryInfo()
    expect(info.failedCount).toBe(1)
    expect(info.nextRetryInMs).not.toBeNull()
  })
})

describe('offline queue — connectivity listeners', () => {
  it('registers and cleans up online/offline listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const cleanup = registerConnectivityListeners(() => {}, () => {})
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    cleanup()
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('isOnline reflects navigator.onLine', () => {
    online = true
    expect(isOnline()).toBe(true)
    online = false
    expect(isOnline()).toBe(false)
  })
})
