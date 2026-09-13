import { describe, expect, it } from 'vitest'
import { findImHereVenue, getImHereMapPath, IM_HERE_PIN_ZOOM, inventoryLayerForImHere, parseHereVenueId, resolveImHereAction, resolveImHereMapZoom, resolveImHereOpen, retainFocusedVenue, wantsImHereCreate } from '../im-here'

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

  it('retries create after a guest pass hydrates into a signed-in session', () => {
    expect(resolveImHereOpen({
      alreadyOpenedVenueId: 'neumos',
      alreadyOpenedCreate: false,
      venueId: 'neumos',
      openCreate: true,
    })).toEqual({ focus: false, create: true })
    expect(resolveImHereOpen({
      alreadyOpenedVenueId: 'neumos',
      alreadyOpenedCreate: true,
      venueId: 'neumos',
      openCreate: true,
    })).toEqual({ focus: false, create: false })
    expect(resolveImHereOpen({
      alreadyOpenedVenueId: null,
      alreadyOpenedCreate: false,
      venueId: 'neumos',
      openCreate: false,
    })).toEqual({ focus: true, create: false })
  })

  it('keeps the shared pin when All Seattle slices to a top-5 preview', () => {
    const catalog = [
      { id: 'hot-1' },
      { id: 'hot-2' },
      { id: 'hot-3' },
      { id: 'hot-4' },
      { id: 'hot-5' },
      { id: 'quiet-osm' },
    ]
    const topFive = catalog.slice(0, 5)
    expect(retainFocusedVenue(topFive, catalog, 'quiet-osm').map((row) => row.id)).toEqual([
      'quiet-osm',
      'hot-1',
      'hot-2',
      'hot-3',
      'hot-4',
      'hot-5',
    ])
    expect(retainFocusedVenue(topFive, catalog, 'hot-2').map((row) => row.id)).toEqual(topFive.map((row) => row.id))
    expect(retainFocusedVenue(topFive, catalog, null)).toHaveLength(5)
  })

  it('zooms the map in to the pin instead of staying city-wide', () => {
    expect(resolveImHereMapZoom(0.8)).toBe(IM_HERE_PIN_ZOOM)
    expect(resolveImHereMapZoom(3.1)).toBe(3.1)
    expect(resolveImHereMapZoom(undefined)).toBe(IM_HERE_PIN_ZOOM)
  })
})
