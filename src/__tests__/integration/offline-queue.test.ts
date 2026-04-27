import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  enqueuePulse,
  getQueue,
  clearQueue,
  processQueue,
  dequeuePulse,
  markFailed,
  getPendingCount,
  type QueuedPulse,
} from '@/lib/offline-queue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueuedPulseInput(overrides: Partial<Omit<QueuedPulse, 'queuedAt' | 'retryCount' | 'status'>> = {}) {
  return {
    id: `pulse-${Math.random().toString(36).slice(2)}`,
    venueId: 'venue-1',
    energyRating: 'buzzing' as const,
    photos: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Offline queue integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    // Default: navigator.onLine = true
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── Queueing when offline ────────────────────────────────
  describe('queueing actions when offline', () => {
    it('enqueues a pulse when offline', () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      const input = makeQueuedPulseInput({ id: 'offline-1' })
      const queued = enqueuePulse(input)

      expect(queued.id).toBe('offline-1')
      expect(queued.status).toBe('pending')
      expect(queued.retryCount).toBe(0)
      expect(queued.queuedAt).toBeDefined()
    })

    it('accumulates multiple items while offline', () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      enqueuePulse(makeQueuedPulseInput({ id: 'off-a' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'off-b' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'off-c' }))

      const queue = getQueue()
      expect(queue).toHaveLength(3)
      expect(queue.map(q => q.id)).toEqual(['off-a', 'off-b', 'off-c'])
    })
  })

  // ── Processing when back online ──────────────────────────
  describe('processing queue when coming back online', () => {
    it('processes all pending items via submitFn', async () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'sync-1' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'sync-2' }))

      const submitFn = vi.fn().mockResolvedValue(true)
      const result = await processQueue(submitFn)

      expect(submitFn).toHaveBeenCalledTimes(2)
      expect(result.synced).toBe(2)
      expect(result.failed).toBe(0)
      // Queue should be empty after successful sync
      expect(getQueue()).toHaveLength(0)
    })

    it('does not process when navigator is offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      enqueuePulse(makeQueuedPulseInput({ id: 'no-sync' }))

      const submitFn = vi.fn().mockResolvedValue(true)
      const result = await processQueue(submitFn)

      expect(submitFn).not.toHaveBeenCalled()
      expect(result.synced).toBe(0)
      expect(result.failed).toBe(0)
      expect(getQueue()).toHaveLength(1)
    })
  })

  // ── Queue persistence across page reload ─────────────────
  describe('queue persistence across page reload', () => {
    it('survives a simulated page reload via localStorage', () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'persist-1', caption: 'hello' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'persist-2', caption: 'world' }))

      // Verify raw localStorage content
      const raw = localStorage.getItem('pulse_offline_queue')
      expect(raw).toBeTruthy()

      // Simulate reload: re-read from localStorage
      const reloaded = JSON.parse(raw!) as QueuedPulse[]
      expect(reloaded).toHaveLength(2)
      expect(reloaded[0].id).toBe('persist-1')
      expect(reloaded[0].caption).toBe('hello')
      expect(reloaded[1].id).toBe('persist-2')
    })

    it('returns empty queue when localStorage is cleared (fresh install)', () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'temp' }))
      localStorage.clear()

      expect(getQueue()).toEqual([])
    })
  })

  // ── FIFO order ───────────────────────────────────────────
  describe('queue order is maintained (FIFO)', () => {
    it('processes items in the order they were enqueued', async () => {
      const order: string[] = []

      enqueuePulse(makeQueuedPulseInput({ id: 'first' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'second' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'third' }))

      const submitFn = vi.fn().mockImplementation(async (pulse: QueuedPulse) => {
        order.push(pulse.id)
        return true
      })

      await processQueue(submitFn)

      expect(order).toEqual(['first', 'second', 'third'])
    })

    it('preserves order in localStorage', () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'a' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'b' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'c' }))

      const queue = getQueue()
      expect(queue.map(q => q.id)).toEqual(['a', 'b', 'c'])
    })
  })

  // ── Failed items are retried ─────────────────────────────
  describe('failed items are retried', () => {
    it('marks items as failed and increments retryCount', () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'fail-1' }))

      markFailed('fail-1')

      const queue = getQueue()
      const item = queue.find(q => q.id === 'fail-1')
      expect(item).toBeDefined()
      expect(item!.status).toBe('failed')
      expect(item!.retryCount).toBe(1)
    })

    it('retries failed items on next processQueue call', async () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'retry-1' }))

      // First attempt fails
      const failingSubmit = vi.fn().mockResolvedValue(false)
      await processQueue(failingSubmit)

      const afterFail = getQueue()
      expect(afterFail).toHaveLength(1)
      expect(afterFail[0].status).toBe('failed')
      expect(afterFail[0].retryCount).toBe(1)

      // Second attempt succeeds
      const succeedingSubmit = vi.fn().mockResolvedValue(true)
      await processQueue(succeedingSubmit)

      expect(getQueue()).toHaveLength(0)
      expect(succeedingSubmit).toHaveBeenCalledTimes(1)
    })

    it('drops items that exceed max retry count (5)', () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'doomed' }))

      // Simulate 6 failures — item should be dropped after the 6th markFailed
      for (let i = 0; i < 6; i++) {
        markFailed('doomed')
      }

      const queue = getQueue()
      expect(queue.find(q => q.id === 'doomed')).toBeUndefined()
    })

    it('invokes onItemResult callback for each attempt', async () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'cb-1' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'cb-2' }))

      const onItemResult = vi.fn()
      const submitFn = vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)

      await processQueue(submitFn, { onItemResult })

      expect(onItemResult).toHaveBeenCalledTimes(2)
      expect(onItemResult).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cb-1' }),
        true,
        expect.any(Number),
      )
      expect(onItemResult).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cb-2' }),
        false,
        expect.any(Number),
      )
    })
  })

  // ── Utility functions ────────────────────────────────────
  describe('utility functions', () => {
    it('getPendingCount returns count of pending and failed items', () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'u-1' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'u-2' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'u-3' }))
      markFailed('u-2')

      // u-1 is pending, u-2 is failed, u-3 is pending — all count
      expect(getPendingCount()).toBe(3)
    })

    it('clearQueue removes all items', () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'clear-1' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'clear-2' }))

      clearQueue()
      expect(getQueue()).toEqual([])
    })

    it('dequeuePulse removes a specific item', () => {
      enqueuePulse(makeQueuedPulseInput({ id: 'rem-1' }))
      enqueuePulse(makeQueuedPulseInput({ id: 'rem-2' }))

      dequeuePulse('rem-1')

      const queue = getQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].id).toBe('rem-2')
    })
  })
})
