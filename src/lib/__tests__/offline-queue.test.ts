import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── localforage mock ─────────────────────────────────────────────────────────
// vi.hoisted runs before vi.mock so hoisted variables are available in the
// factory even after Vitest lifts the vi.mock call to the top of the module.

const { storeRegistry } = vi.hoisted(() => {
  const storeRegistry: Record<string, Record<string, unknown>> = {}
  return { storeRegistry }
})

vi.mock('localforage', () => {
  return {
    default: {
      createInstance: (opts: { storeName: string }) => {
        const name = opts.storeName
        if (!storeRegistry[name]) storeRegistry[name] = {}
        const store = storeRegistry[name]
        return {
          setItem: async (key: string, val: unknown) => { store[key] = val },
          getItem: async (key: string) => store[key] ?? null,
          removeItem: async (key: string) => { delete store[key] },
          clear: async () => { Object.keys(store).forEach(k => delete store[k]) },
          iterate: async (fn: (val: unknown, key: string) => void) => {
            for (const [k, v] of Object.entries(store)) fn(v, k)
          },
        }
      },
    },
  }
})

// Mock localStorage
const lsStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => lsStore[key] ?? null,
  setItem: (key: string, val: string) => { lsStore[key] = val },
  removeItem: (key: string) => { delete lsStore[key] },
})

vi.stubGlobal('navigator', { onLine: true })

// ── Imports after mocks ───────────────────────────────────────────────────────

import {
  enqueuePulse,
  getQueue,
  dequeuePulse,
  markSyncing,
  markFailed,
  getPendingCount,
  clearQueue,
  processQueue,
} from '../offline-queue'

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Reset all in-memory stores
  for (const name of Object.keys(storeRegistry)) {
    const s = storeRegistry[name]
    Object.keys(s).forEach(k => delete s[k])
  }
  // Reset localStorage mirror
  Object.keys(lsStore).forEach(k => delete lsStore[k])
  await clearQueue()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('enqueuePulse', () => {
  it('adds a pulse to the queue with pending status', async () => {
    const queued = await enqueuePulse({
      id: 'p1',
      venueId: 'v1',
      energyRating: 'buzzing',
      photos: [],
    })
    expect(queued.status).toBe('pending')
    expect(queued.retryCount).toBe(0)
    const queue = await getQueue()
    expect(queue.length).toBe(1)
  })

  it('sets clientTimestamp for conflict resolution', async () => {
    const before = Date.now()
    const queued = await enqueuePulse({ id: 'p2', venueId: 'v1', energyRating: 'chill', photos: [] })
    expect(queued.clientTimestamp).toBeGreaterThanOrEqual(before)
  })
})

describe('dequeuePulse', () => {
  it('removes a specific pulse from the queue', async () => {
    await enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    await enqueuePulse({ id: 'p2', venueId: 'v1', energyRating: 'buzzing', photos: [] })
    await dequeuePulse('p1')
    const queue = await getQueue()
    expect(queue.length).toBe(1)
    expect(queue[0].id).toBe('p2')
  })
})

describe('markSyncing', () => {
  it('updates item status to syncing', async () => {
    await enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    await markSyncing('p1')
    const queue = await getQueue()
    expect(queue[0].status).toBe('syncing')
  })
})

describe('markFailed', () => {
  it('increments retry count and sets failed status', async () => {
    await enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    await markFailed('p1')
    const queue = await getQueue()
    expect(queue[0].status).toBe('failed')
    expect(queue[0].retryCount).toBe(1)
  })

  it('moves item to dead-letter queue after exceeding MAX_RETRY_ATTEMPTS (5)', async () => {
    await enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    // Fail 6 times to exceed the limit of 5
    for (let i = 0; i < 6; i++) await markFailed('p1')
    const queue = await getQueue()
    expect(queue.length).toBe(0)
  })
})

describe('getPendingCount', () => {
  it('returns a non-negative number from the sync cache', async () => {
    await enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    await enqueuePulse({ id: 'p2', venueId: 'v1', energyRating: 'buzzing', photos: [] })
    const count = getPendingCount()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

describe('processQueue', () => {
  it('syncs all pending items on success', async () => {
    await enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    await enqueuePulse({ id: 'p2', venueId: 'v1', energyRating: 'buzzing', photos: [] })

    const result = await processQueue(async () => true)
    expect(result.synced).toBe(2)
    expect(result.failed).toBe(0)
    const queue = await getQueue()
    expect(queue.length).toBe(0)
  })

  it('marks items as failed when submitFn throws', async () => {
    await enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })

    const result = await processQueue(async () => { throw new Error('network error') })
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(1)
    const queue = await getQueue()
    expect(queue[0].status).toBe('failed')
    expect(queue[0].lastError).toBe('network error')
  })

  it('marks items as failed when submitFn returns false', async () => {
    await enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'electric', photos: [] })

    const result = await processQueue(async () => false)
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(1)
  })

  it('skips processing when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    const result = await processQueue(async () => true)
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(0)
    vi.stubGlobal('navigator', { onLine: true })
  })
})
