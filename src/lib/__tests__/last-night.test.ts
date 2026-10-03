import { describe, expect, it } from 'vitest'
import type { Pulse, Venue } from '../types'
import { LAST_NIGHT_EMPTY, lastNightDateKey, listLastNightRooms } from '../last-night'

function venue(id: string, name = id): Venue {
  return {
    id,
    name,
    location: { lat: 47.61, lng: -122.32, address: 'Pike' },
    pulseScore: 0,
  }
}

function pulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'me',
    venueId: 'neumos',
    photos: [],
    energyRating: 'chill',
    createdAt: '2026-09-14T04:00:00.000Z',
    expiresAt: '2026-09-14T05:30:00.000Z',
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('last night', () => {
  it('recaps rooms the user pulsed, pinned, or was here — honest empty otherwise', () => {
    const now = new Date('2026-09-14T18:00:00.000Z')
    expect(lastNightDateKey(now)).toBe('2026-09-13')
    const rooms = listLastNightRooms({
      venues: [venue('neumos', 'Neumos'), venue('barrio', 'Barrio')],
      pulses: [pulse()],
      userId: 'me',
      pinnedVenueIds: ['barrio'],
      presence: [{
        venueId: 'neumos',
        userId: 'me',
        checkedInAt: '2026-09-14T04:30:00.000Z',
      }],
      now,
    })
    expect(rooms.map((row) => row.venue.id).sort()).toEqual(['barrio', 'neumos'])
    expect(rooms.find((row) => row.venue.id === 'neumos')?.reasons).toEqual(['pulsed', 'here'])
    expect(listLastNightRooms({
      venues: [venue('neumos')],
      pulses: [],
      userId: 'me',
      now,
    })).toEqual([])
    expect(LAST_NIGHT_EMPTY).toMatch(/No rooms/)
  })
})
