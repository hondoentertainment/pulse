import { describe, expect, it } from 'vitest'
import type { Pulse, Venue } from '../types'
import { buildTonightDigest, shouldShowTonightDigest, TONIGHT_DIGEST_QUIET } from '../tonight-digest'

function venue(): Venue {
  return {
    id: 'neumos',
    name: 'Neumos',
    location: { lat: 47.61, lng: -122.32, address: '' },
    pulseScore: 0,
  }
}

function pulse(createdAt: string): Pulse {
  return {
    id: 'p1',
    userId: 'u1',
    venueId: 'neumos',
    photos: [],
    energyRating: 'electric',
    createdAt,
    expiresAt: createdAt,
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
  }
}

describe('tonight digest', () => {
  it('lists followed venues that went live, else honest quiet', () => {
    const now = new Date('2026-09-14T03:10:00.000Z')
    const live = buildTonightDigest({
      venues: [venue()],
      pulses: [pulse('2026-09-14T01:00:00.000Z')],
      followedVenueIds: ['neumos'],
      now,
    })
    expect(live.kind).toBe('live')
    expect(live.body).toContain('Neumos')

    const quiet = buildTonightDigest({
      venues: [venue()],
      pulses: [],
      followedVenueIds: ['neumos'],
      now,
    })
    expect(quiet.kind).toBe('quiet')
    expect(quiet.title).toBe(TONIGHT_DIGEST_QUIET)
  })

  it('fires once at 8pm local', () => {
    const eight = new Date('2026-09-14T03:05:00.000Z')
    expect(shouldShowTonightDigest({ now: eight, lastShownDateKey: null })).toBe(true)
    expect(shouldShowTonightDigest({ now: eight, lastShownDateKey: '2026-09-13' })).toBe(false)
    expect(shouldShowTonightDigest({ now: new Date('2026-09-14T18:00:00.000Z'), lastShownDateKey: null })).toBe(false)
  })
})
