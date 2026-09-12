import { describe, expect, it } from 'vitest'
import { findImHereVenue, getImHereMapPath, inventoryLayerForImHere, parseHereVenueId, resolveImHereAction, wantsImHereCreate } from '../im-here'

describe('im-here deep link', () => {
  it('parses here and create query params', () => {
    expect(parseHereVenueId('?here=neumos')).toBe('neumos')
    expect(parseHereVenueId(new URLSearchParams('here=barrio'))).toBe('barrio')
    expect(wantsImHereCreate('?here=neumos&create=1')).toBe(true)
    expect(getImHereMapPath('v1')).toBe('/?here=v1')
    expect(getImHereMapPath('v1', { create: true })).toBe('/?here=v1&create=1')
  })

  it('opens create for signed-in users and leaves guests on the map', () => {
    expect(resolveImHereAction({
      venueId: 'neumos',
      isPlaceholder: false,
      hasSession: true,
    })).toMatchObject({ openCreate: true, authRedirect: null })
    expect(resolveImHereAction({
      venueId: 'neumos',
      isPlaceholder: false,
      hasSession: false,
    })).toMatchObject({ openCreate: false, authRedirect: '/auth' })
  })

  it('waits for the catalog before focusing and opens All Seattle for OSM pins', () => {
    expect(findImHereVenue([], 'neumos')).toBeNull()
    expect(findImHereVenue([
      {
        id: 'neumos',
        name: 'Neumos',
        location: { lat: 47.6, lng: -122.3, address: 'Pike' },
        pulseScore: 0,
        inventorySource: 'osm',
      },
    ], 'neumos')?.id).toBe('neumos')
    expect(inventoryLayerForImHere({ inventorySource: 'osm' }, 'curated')).toBe('all')
    expect(inventoryLayerForImHere({ inventorySource: 'curated-seed' }, 'curated')).toBe('curated')
  })
})
