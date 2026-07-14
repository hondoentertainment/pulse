import { describe, it, expect } from 'vitest'
import {
  applySignalSuppressionToVenue,
  filterNonSuppressedVenues,
  isVenueSignalSuppressed,
} from '../signal-suppress'
import type { Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Test Bar',
    location: { lat: 47.6, lng: -122.3, address: '123 Main' },
    pulseScore: 50,
    ...overrides,
  }
}

describe('isVenueSignalSuppressed', () => {
  it('returns false when flag is unset', () => {
    expect(isVenueSignalSuppressed(makeVenue())).toBe(false)
  })

  it('returns true when signalSuppressed is true', () => {
    expect(isVenueSignalSuppressed(makeVenue({ signalSuppressed: true }))).toBe(true)
  })
})

describe('filterNonSuppressedVenues', () => {
  it('removes suppressed venues', () => {
    const venues = [
      makeVenue({ id: 'a' }),
      makeVenue({ id: 'b', signalSuppressed: true }),
      makeVenue({ id: 'c' }),
    ]
    expect(filterNonSuppressedVenues(venues).map((v) => v.id)).toEqual(['a', 'c'])
  })
})

describe('applySignalSuppressionToVenue', () => {
  it('sets suppression fields when enabling', () => {
    const updated = applySignalSuppressionToVenue(makeVenue(), true, 'spam')
    expect(updated.signalSuppressed).toBe(true)
    expect(updated.signalSuppressedReason).toBe('spam')
    expect(updated.signalSuppressedAt).toBeTruthy()
  })

  it('clears suppression fields when disabling', () => {
    const updated = applySignalSuppressionToVenue(
      makeVenue({ signalSuppressed: true, signalSuppressedReason: 'spam' }),
      false,
    )
    expect(updated.signalSuppressed).toBe(false)
    expect(updated.signalSuppressedReason).toBeNull()
    expect(updated.signalSuppressedAt).toBeNull()
  })
})
