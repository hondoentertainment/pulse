import { describe, expect, it } from 'vitest'
import { isVenueDeepLinkPath } from '../guest-discovery'
import { resolveShareVenueReady } from '../share-landing'

describe('share venue landing', () => {
  it('treats /venue/:id as a deep link and ignores inbox or the bare /venue path', () => {
    expect(isVenueDeepLinkPath('/venue/neumos')).toBe(true)
    expect(isVenueDeepLinkPath('/venue/neumos/')).toBe(true)
    expect(isVenueDeepLinkPath('/venue')).toBe(false)
    expect(isVenueDeepLinkPath('/venue/neumos/inbox')).toBe(false)
    expect(isVenueDeepLinkPath('/')).toBe(false)
  })

  it('stays pending until a single venue or the catalog can answer', () => {
    expect(resolveShareVenueReady({
      cached: false,
      fresh: false,
      catalogReady: false,
      lookupSettled: false,
    })).toBe('pending')
    expect(resolveShareVenueReady({
      cached: false,
      fresh: true,
      catalogReady: false,
      lookupSettled: false,
    })).toBe('ready')
    expect(resolveShareVenueReady({
      cached: false,
      fresh: false,
      catalogReady: true,
      lookupSettled: true,
    })).toBe('missing')
  })
})
