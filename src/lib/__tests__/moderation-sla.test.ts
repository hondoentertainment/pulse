import { describe, expect, it } from 'vitest'
import { filterModeratedPulses, createReport } from '../content-moderation'
import { hidePulseForReporter, moderationResolution } from '../moderation-sla'
import type { Pulse } from '../types'

function pulse(id: string): Pulse {
  return {
    id,
    userId: 'author',
    venueId: 'v',
    photos: [],
    energyRating: 'chill',
    createdAt: '2026-10-01T00:00:00.000Z',
    expiresAt: '2026-10-01T02:00:00.000Z',
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
  }
}

describe('moderation SLA', () => {
  it('hides the reported pulse for the reporter in the same turn', () => {
    const pulses = [pulse('keep'), pulse('reported')]
    const started = Date.now()
    const visible = hidePulseForReporter(pulses, 'reporter', 'reported', 'spam')
    expect(Date.now() - started).toBeLessThan(1000)
    expect(visible.map((row) => row.id)).toEqual(['keep'])
    const report = createReport('reporter', 'pulse', 'reported', 'spam')
    expect(filterModeratedPulses(pulses, 'someone-else', [], [], [report]).map((row) => row.id)).toEqual([
      'keep',
      'reported',
    ])
  })

  it('requires an admin reason to resolve or dismiss', () => {
    expect(moderationResolution({ admin: true, status: 'actioned', reason: '  ' }).ok).toBe(false)
    expect(moderationResolution({ admin: true, status: 'dismissed', reason: '' }).ok).toBe(false)
    const resolved = moderationResolution({ admin: true, status: 'actioned', reason: 'Spam, removed' })
    expect(resolved).toEqual({ ok: true, note: 'Spam, removed' })
    expect(moderationResolution({ admin: false, status: 'dismissed' })).toEqual({ ok: true, note: null })
    expect(moderationResolution({ admin: true, status: 'actioned', reason: 'x'.repeat(281) }).ok).toBe(false)
  })
})
