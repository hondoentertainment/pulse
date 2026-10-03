import { describe, expect, it } from 'vitest'
import { canPinFromTheDoor, orderPulsesDoorPinnedFirst, pinDoorPulse } from '../door-pin'
import type { Pulse } from '../types'

function pulse(id: string, createdAt: string): Pulse {
  return {
    id,
    userId: 'u',
    venueId: 'neumos',
    photos: [],
    energyRating: 'chill',
    createdAt,
    expiresAt: createdAt,
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
  }
}

describe('door pin', () => {
  it('lets verified owners pin one tonight pulse to the top', () => {
    expect(canPinFromTheDoor({
      userId: 'owner',
      venueId: 'neumos',
      claims: [{
        id: 'c1',
        venueId: 'neumos',
        claimantUserId: 'owner',
        businessName: 'Neumos',
        businessEmail: 'x@neumos.com',
        verificationMethod: 'email',
        status: 'verified',
        createdAt: '2026-01-01',
      }],
    })).toBe(true)
    expect(canPinFromTheDoor({
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

    const pin = pinDoorPulse({ venueId: 'neumos', pulseId: 'old', userId: 'owner' })
    const ordered = orderPulsesDoorPinnedFirst([
      pulse('new', '2026-09-14T05:00:00.000Z'),
      pulse('old', '2026-09-14T03:00:00.000Z'),
    ], pin, new Date('2026-09-14T06:00:00.000Z'))
    expect(ordered.map((row) => row.id)).toEqual(['old', 'new'])
  })
})
