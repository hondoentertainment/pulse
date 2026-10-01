import { describe, expect, it } from 'vitest'
import {
  claimVenueSurgeNotice,
  type SurgeNoticeWriter,
} from '../venue-surge-claim'

function writer(script: {
  update?: { error?: { code?: string; message?: string } | null; rows: number }
  insert?: { error?: { code?: string; message?: string } | null }
}): SurgeNoticeWriter & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async updateIfOlder() {
      calls.push('update')
      return { error: script.update?.error ?? null, rows: script.update?.rows ?? 0 }
    },
    async insert() {
      calls.push('insert')
      return { error: script.insert?.error ?? null }
    },
  }
}

describe('claimVenueSurgeNotice', () => {
  const input = {
    venueId: 'neumos',
    pulseId: 'pulse-1',
    nowIso: '2026-09-30T04:00:00.000Z',
    cutoffIso: '2026-09-30T02:00:00.000Z',
  }

  it('claims an open window by updating a stale notice', async () => {
    const store = writer({ update: { rows: 1 } })
    await expect(claimVenueSurgeNotice(store, input)).resolves.toBe('claimed')
    expect(store.calls).toEqual(['update'])
  })

  it('inserts the first notice when no row exists', async () => {
    const store = writer({ update: { rows: 0 }, insert: {} })
    await expect(claimVenueSurgeNotice(store, input)).resolves.toBe('claimed')
    expect(store.calls).toEqual(['update', 'insert'])
  })

  it('treats a unique conflict as the 2 hour rate limit', async () => {
    const store = writer({
      update: { rows: 0 },
      insert: { error: { code: '23505', message: 'duplicate key value' } },
    })
    await expect(claimVenueSurgeNotice(store, input)).resolves.toBe('rate_limited')
  })

  it('no-ops when the rate-limit table is missing', async () => {
    const store = writer({
      update: { rows: 0 },
      insert: { error: { code: 'PGRST205', message: 'venue_surge_notices' } },
    })
    await expect(claimVenueSurgeNotice(store, input)).resolves.toBe('unavailable')
  })
})
