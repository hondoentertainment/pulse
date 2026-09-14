import { describe, expect, it } from 'vitest'
import type { Venue } from '../types'
import { listHopNextVenues } from '../hop-next'

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'neumos',
    name: 'Neumos',
    neighborhood: 'Capitol Hill',
    location: { lat: 47.61, lng: -122.32, address: 'Pike' },
    pulseScore: 0,
    inventorySource: 'curated-seed',
    seeded: true,
    ...overrides,
  }
}

describe('hop next', () => {
  it('returns two Start-here rooms in the same neighborhood without GPS', () => {
    const rooms = [
      venue(),
      venue({ id: 'barrio', name: 'Barrio', claimVerified: true }),
      venue({ id: 'chop', name: 'Chop Suey' }),
      venue({ id: 'q', name: 'Q Nightclub' }),
      venue({ id: 'sunset', name: 'Sunset', neighborhood: 'Ballard' }),
    ]
    const next = listHopNextVenues(rooms, rooms[0])
    expect(next).toHaveLength(2)
    expect(next.every((row) => row.neighborhood === 'Capitol Hill')).toBe(true)
    expect(next.map((row) => row.id)).not.toContain('neumos')
    expect(next.map((row) => row.id)).not.toContain('sunset')
  })

  it('is empty when the hood has no other catalog rooms', () => {
    expect(listHopNextVenues([venue()], venue())).toEqual([])
    expect(listHopNextVenues([venue({ neighborhood: undefined })], venue({ neighborhood: undefined }))).toEqual([])
  })
})
