import { describe, expect, it } from 'vitest'
import {
  buildOwnerWeeklyNote,
  canSendOwnerWeekly,
  isSundayInSeattle,
  ownerWeeklyNoopReason,
  shouldShowOwnerWeekly,
} from '../owner-weekly'
import type { Pulse } from '../types'

const pulse: Pulse = {
  id: 'p1',
  userId: 'u',
  venueId: 'neumos',
  photos: [],
  energyRating: 'buzzing',
  createdAt: '2026-09-10T04:00:00.000Z',
  expiresAt: '2026-09-10T05:30:00.000Z',
  reactions: { fire: [], eyes: [], skull: [], lightning: [] },
  views: 0,
}

describe('owner weekly', () => {
  it('is verified-only, Sunday, and no-ops without CRON_SECRET', () => {
    expect(ownerWeeklyNoopReason({})).toBe('missing_secret')
    expect(ownerWeeklyNoopReason({ CRON_SECRET: 'x' })).toBeNull()
    expect(canSendOwnerWeekly({
      userId: 'owner',
      venueId: 'neumos',
      claims: [{
        id: 'c1',
        venueId: 'neumos',
        claimantUserId: 'owner',
        businessName: 'Neumos',
        businessEmail: 'x@neumos.com',
        verificationMethod: 'email',
        status: 'pending',
        createdAt: '2026-01-01',
      }],
    })).toBe(false)
    const sunday = new Date('2026-09-13T20:00:00.000Z')
    expect(isSundayInSeattle(sunday)).toBe(true)
    expect(shouldShowOwnerWeekly({ now: sunday, verified: true })).toBe(true)
    expect(shouldShowOwnerWeekly({ now: sunday, verified: false })).toBe(false)
    const note = buildOwnerWeeklyNote({
      venueId: 'neumos',
      venueName: 'Neumos',
      pulses: [pulse],
      hereNowCount: 2,
      now: new Date('2026-09-13T20:00:00.000Z'),
    })
    expect(note.body).toContain('1 pulses')
    expect(note.body).toContain('2 here-now')
  })
})
