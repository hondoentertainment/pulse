import { describe, expect, it } from 'vitest'
import { appleMapsHref, googleMapsHref, isAppleMapsPlatform, venueMapsHref } from '../venue-maps'

describe('venue maps', () => {
  it('opens Apple Maps on iOS and Google Maps otherwise', () => {
    expect(isAppleMapsPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
    expect(isAppleMapsPlatform('Mozilla/5.0 (Linux; Android 14)')).toBe(false)
    expect(venueMapsHref({
      lat: 47.6145,
      lng: -122.3205,
      name: 'Neumos',
      userAgent: 'iPhone',
    })).toContain('maps.apple.com')
    expect(googleMapsHref({ lat: 47.6, lng: -122.3, name: 'Neumos' })).toContain('google.com/maps')
    expect(appleMapsHref({ lat: 47.6, lng: -122.3, name: 'Neumos' })).toContain('ll=47.6%2C-122.3')
  })
})
