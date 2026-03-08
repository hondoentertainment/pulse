import { describe, it, expect, beforeEach, vi } from 'vitest'
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

// Mock localStorage
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val },
  removeItem: (key: string) => { delete store[key] },
})

vi.stubGlobal('navigator', { onLine: true })

beforeEach(() => {
  clearQueue()
})

describe('enqueuePulse', () => {
  it('adds a pulse to the queue', () => {
    const queued = enqueuePulse({
      id: 'p1',
      venueId: 'v1',
      energyRating: 'buzzing',
      photos: [],
    })
    expect(queued.status).toBe('pending')
    expect(queued.retryCount).toBe(0)
    expect(getQueue().length).toBe(1)
  })
})

describe('dequeuePulse', () => {
  it('removes a pulse from the queue', () => {
    enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    enqueuePulse({ id: 'p2', venueId: 'v1', energyRating: 'buzzing', photos: [] })
    dequeuePulse('p1')
    expect(getQueue().length).toBe(1)
    expect(getQueue()[0].id).toBe('p2')
  })
})

describe('markSyncing', () => {
  it('updates status to syncing', () => {
    enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    markSyncing('p1')
    expect(getQueue()[0].status).toBe('syncing')
  })
})

describe('markFailed', () => {
  it('increments retry count and sets failed', () => {
    enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    markFailed('p1')
    const item = getQueue()[0]
    expect(item.status).toBe('failed')
    expect(item.retryCount).toBe(1)
  })

  it('drops items after too many retries', () => {
    enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    for (let i = 0; i < 6; i++) markFailed('p1')
    expect(getQueue().length).toBe(0)
  })
})

describe('getPendingCount', () => {
  it('counts pending and failed items', () => {
    enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    enqueuePulse({ id: 'p2', venueId: 'v1', energyRating: 'buzzing', photos: [] })
    markFailed('p1')
    expect(getPendingCount()).toBe(2) // 1 failed + 1 pending
  })
})

describe('processQueue', () => {
  it('syncs pending items', async () => {
    enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })
    enqueuePulse({ id: 'p2', venueId: 'v1', energyRating: 'buzzing', photos: [] })

    const result = await processQueue(async () => true)
    expect(result.synced).toBe(2)
    expect(result.failed).toBe(0)
    expect(getQueue().length).toBe(0)
  })

  it('marks failed items on error', async () => {
    enqueuePulse({ id: 'p1', venueId: 'v1', energyRating: 'chill', photos: [] })

    const result = await processQueue(async () => { throw new Error('network') })
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(1)
    expect(getQueue()[0].status).toBe('failed')
  })
})
