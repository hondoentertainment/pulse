import { describe, expect, it } from 'vitest'
import type { Pulse, Venue } from '../types'
import { listFollowedPeoplePulses, mixFollowingFeed } from '../friends-follow'

function venue(): Venue {
  return {
    id: 'neumos',
    name: 'Neumos',
    location: { lat: 47.61, lng: -122.32, address: '' },
    pulseScore: 0,
  }
}

function pulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'friend',
    venueId: 'neumos',
    photos: [],
    energyRating: 'buzzing',
    createdAt: '2026-09-14T01:00:00.000Z',
    expiresAt: '2026-09-14T02:30:00.000Z',
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('friends follow', () => {
  it('mixes followed people’s pulses with followed venues', () => {
    const friendRows = listFollowedPeoplePulses(
      [pulse(), pulse({ id: 'p2', userId: 'stranger' })],
      [venue()],
      ['friend'],
    )
    expect(friendRows).toHaveLength(1)
    expect(friendRows[0]?.pulse.userId).toBe('friend')

    const mixed = mixFollowingFeed(
      [{ venue: venue(), latestPulse: null }],
      friendRows,
    )
    expect(mixed.some((row) => row.kind === 'friend_pulse')).toBe(true)
    expect(mixed.some((row) => row.kind === 'venue')).toBe(true)
  })
})
