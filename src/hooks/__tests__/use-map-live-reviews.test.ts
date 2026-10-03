// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMapLiveReviews } from '@/hooks/use-map-live-reviews'
import type { Pulse, Venue } from '@/lib/types'

function makeVenue(): Venue {
  return {
    id: 'venue-1',
    name: 'Neon Lounge',
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    pulseScore: 70,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p-1',
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'electric',
    caption: 'DJ just switched — floor is packed.',
    kind: 'review',
    hasBody: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('useMapLiveReviews', () => {
  it('does not toast reviews that were already on the map', () => {
    const { result } = renderHook(() => useMapLiveReviews([makePulse()], [makeVenue()]))
    expect(result.current.toast).toBeNull()
  })

  it('surfaces a toast when a new live review arrives', () => {
    const venue = makeVenue()
    const existing = makePulse({ id: 'existing' })
    const { result, rerender } = renderHook(
      ({ pulses }) => useMapLiveReviews(pulses, [venue]),
      { initialProps: { pulses: [existing] } },
    )
    expect(result.current.toast).toBeNull()

    rerender({ pulses: [makePulse({ id: 'fresh', caption: 'Bar is three deep.' }), existing] })
    expect(result.current.toast).toMatchObject({
      id: 'fresh',
      venueName: 'Neon Lounge',
      snippet: 'Bar is three deep.',
      headline: '⚡ Neon Lounge just went Electric',
    })
    expect(result.current.bloomVenueId).toBe('venue-1')
  })
})
