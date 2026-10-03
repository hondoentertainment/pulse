import { describe, expect, it } from 'vitest'
import { evaluateLocationProof, resolvePostedLocationVerified } from '../location-proof.ts'

const venue = { lat: 47.6145, lng: -122.3205 }

describe('evaluateLocationProof', () => {
  it('marks GPS-denied as unverified without blocking', () => {
    expect(evaluateLocationProof(null, venue)).toEqual({
      locationVerified: false,
      reason: 'location_unavailable',
    })
  })

  it('verifies a near-venue coordinate', () => {
    const proof = evaluateLocationProof({ lat: 47.6145, lng: -122.3205 }, venue)
    expect(proof.locationVerified).toBe(true)
    expect(proof.reason).toBe('verified')
  })
})

describe('resolvePostedLocationVerified', () => {
  it('never trusts a client verified flag without coordinates', () => {
    const proof = resolvePostedLocationVerified({
      clientVerified: true,
      userLocation: null,
      venueLocation: venue,
    })
    expect(proof.locationVerified).toBe(false)
    expect(proof.reason).toBe('location_unavailable')
  })

  it('overrides a client verified flag when the user is far away', () => {
    const proof = resolvePostedLocationVerified({
      clientVerified: true,
      userLocation: { lat: 47.7, lng: -122.4 },
      venueLocation: venue,
    })
    expect(proof.locationVerified).toBe(false)
    expect(proof.reason).toBe('outside_radius')
  })
})
