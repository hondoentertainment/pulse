import { describe, expect, it } from 'vitest'
import type { Pulse, Venue } from '../types'
import { buildQuietNightNote, isSurgingEmpty, shouldShowQuietNight } from '../quiet-night'

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'sunset',
    name: 'Sunset Tavern',
    neighborhood: 'Ballard',
    location: { lat: 47.67, lng: -122.38, address: '' },
    pulseScore: 0,
    inventorySource: 'curated-seed',
    seeded: true,
    ...overrides,
  }
}

describe('quiet-night coach', () => {
  it('asks people to be first when Surging is empty — never invents a crowd', () => {
    expect(isSurgingEmpty([])).toBe(true)
    expect(isSurgingEmpty([{
      id: 'p',
      userId: 'u',
      venueId: 'sunset',
      photos: [],
      energyRating: 'chill',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      reactions: { fire: [], eyes: [], skull: [], lightning: [] },
      views: 0,
    } as Pulse])).toBe(false)

    const note = buildQuietNightNote({
      venues: [venue()],
      pulses: [],
      followedVenueIds: ['sunset'],
    })
    expect(note?.body).toBe('Be the first at Sunset Tavern')
  })

  it('only reminds around 9pm when Surging is empty', () => {
    const nine = new Date('2026-09-14T04:05:00.000Z')
    expect(shouldShowQuietNight({ now: nine, lastShownDateKey: null, surgingEmpty: true })).toBe(true)
    expect(shouldShowQuietNight({ now: nine, lastShownDateKey: null, surgingEmpty: false })).toBe(false)
  })
})
