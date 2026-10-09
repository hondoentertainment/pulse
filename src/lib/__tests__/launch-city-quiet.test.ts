import { describe, expect, it } from 'vitest'
import {
  buildLaunchQuietTonight,
  launchQuietCities,
  launchQuietCity,
  launchQuietRateOpen,
  venuesInCoastCity,
  planLaunchQuietPush,
  shouldSendLaunchQuietPush,
} from '../launch-city-quiet'
import type { Pulse, Venue } from '../types'

const FRIDAY_9PM = new Date('2026-10-10T04:00:00.000Z')

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'pdx-crystal-ballroom',
    name: 'Crystal Ballroom',
    city: 'Portland',
    state: 'OR',
    neighborhood: 'Pearl District',
    location: { lat: 45.52, lng: -122.68, address: 'Burnside' },
    pulseScore: 0,
    inventorySource: 'curated-seed',
    seeded: true,
    ...overrides,
  }
}

function pulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'u1',
    venueId: 'pdx-crystal-ballroom',
    photos: [],
    energyRating: 'buzzing',
    createdAt: '2026-10-10T02:00:00.000Z',
    expiresAt: '2026-10-10T04:00:00.000Z',
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('launch city quiet tonight', () => {
  it('shows the Portland Friday empty state at 0 and never invents a crowd', () => {
    const empty = buildLaunchQuietTonight({
      venues: [venue(), venue({ id: 'pdx-teardrop', name: 'Teardrop Cocktail Lounge' })],
      pulses: [],
      followedVenueIds: ['pdx-crystal-ballroom'],
      now: FRIDAY_9PM,
    })
    expect(empty?.headline).toBe('Quiet Friday — no pulses yet at the rooms you follow.')
    expect(empty?.body).toContain('at 0 tonight')
    expect(empty?.body).toContain('never invent a crowd')
    expect(empty?.cta).toBe('Post first pulse')
    expect(empty?.steps[0]).toBe('Open Crystal Ballroom')
    expect(empty?.countLine).toBe('0 · no pulses yet tonight')
    expect(empty?.launchLine).toContain('Portland launch set')
    expect(empty?.countLine).not.toMatch(/[1-9]/)
  })

  it('splits a mixed catalog so each launched city can be pushed on its own', () => {
    const mixed = [
      venue({ id: 'venue-1', name: 'Neumos', city: 'Seattle', state: 'WA' }),
      venue(),
      venue({ id: 'sf-chapel', name: 'The Chapel', city: 'San Francisco', state: 'CA', neighborhood: 'Mission' }),
    ]
    expect(launchQuietCity(mixed)).toBeNull()
    expect(launchQuietCities(mixed).map((city) => city.key)).toEqual(['portland', 'san-francisco'])
    expect(venuesInCoastCity(mixed, launchQuietCities(mixed)[0]).map((row) => row.id)).toEqual(['pdx-crystal-ballroom'])
  })

  it('stays off for Seattle and when a curated room already has a pulse tonight', () => {
    expect(buildLaunchQuietTonight({
      venues: [venue({ id: 'venue-1', name: 'Neumos', city: 'Seattle', state: 'WA' })],
      pulses: [],
      now: FRIDAY_9PM,
    })).toBeNull()
    expect(buildLaunchQuietTonight({
      venues: [venue()],
      pulses: [pulse()],
      now: FRIDAY_9PM,
    })).toBeNull()
  })

  it('ignores a hidden pulse so the city can still be quiet', () => {
    const empty = buildLaunchQuietTonight({
      venues: [venue()],
      pulses: [pulse({ hiddenAt: '2026-10-10T02:30:00.000Z' })],
      now: FRIDAY_9PM,
    })
    expect(empty?.venue.name).toBe('Crystal Ballroom')
  })

  it('plans one quiet-night push, rate-limited, muted, and quiet-hours aware', () => {
    const plan = planLaunchQuietPush({
      venues: [venue()],
      pulses: [],
      followedVenueIds: ['pdx-crystal-ballroom'],
      now: FRIDAY_9PM,
    })
    expect(plan?.payload.title).toBe('Quiet night in Portland')
    expect(plan?.payload.body).toContain('Be the first at Crystal Ballroom')
    expect(plan?.payload.actions?.map((action) => action.title)).toEqual([
      'Post first pulse',
      'Open Tonight · Portland',
      'Mute Friday prompts',
    ])
    expect(plan?.payload.url).toBe('/venue/pdx-crystal-ballroom')
    expect(planLaunchQuietPush({
      venues: [venue()],
      pulses: [],
      followedVenueIds: ['pdx-crystal-ballroom'],
      now: FRIDAY_9PM,
      lastNotifiedAt: '2026-10-10T03:00:00.000Z',
    })).toBeNull()
    expect(launchQuietRateOpen('2026-10-09T04:00:00.000Z', FRIDAY_9PM)).toBe(true)
    expect(shouldSendLaunchQuietPush({
      followsCity: true,
      muted: true,
      quietStart: null,
      quietEnd: null,
      hour: 21,
    })).toBe(false)
    expect(shouldSendLaunchQuietPush({
      followsCity: true,
      muted: false,
      quietStart: 22,
      quietEnd: 7,
      hour: 23,
    })).toBe(false)
    expect(shouldSendLaunchQuietPush({
      followsCity: true,
      muted: false,
      quietStart: 22,
      quietEnd: 7,
      hour: 21,
    })).toBe(true)
    expect(shouldSendLaunchQuietPush({
      followsCity: false,
      muted: false,
      quietStart: null,
      quietEnd: null,
      hour: 21,
    })).toBe(false)
    expect(planLaunchQuietPush({
      venues: [venue()],
      pulses: [],
      now: new Date('2026-10-10T18:00:00.000Z'),
    })).toBeNull()
  })
})
