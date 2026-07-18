import { describe, it, expect } from 'vitest'
import {
  normalizeShortlistVenueIds,
  parseShortlistVenueIds,
  buildShortlistPath,
  resolveShortlistVenues,
  buildShortlistShareText,
  SHORTLIST_MAX_VENUES,
} from '../shortlist'
import type { Venue } from '../types'

function venue(id: string, name: string, score = 50): Venue {
  return {
    id,
    name,
    category: 'bar',
    location: { lat: 47.6, lng: -122.3, address: 'Seattle, WA' },
    pulseScore: score,
  }
}

describe('shortlist', () => {
  it('normalizes, dedupes, and caps venue ids', () => {
    const ids = normalizeShortlistVenueIds([
      'a',
      ' a ',
      'b',
      'c',
      'd',
      'e',
      'f',
      '',
    ])
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(ids).toHaveLength(SHORTLIST_MAX_VENUES)
  })

  it('parses query string venue lists', () => {
    expect(parseShortlistVenueIds('v=one,two')).toEqual(['one', 'two'])
    expect(parseShortlistVenueIds(new URLSearchParams('v=one&v=two'))).toEqual([
      'one',
      'two',
    ])
  })

  it('builds share path and resolves venues', () => {
    expect(buildShortlistPath(['x', 'y'])).toBe('/shortlist?v=x,y')
    const catalog = [venue('x', 'X', 80), venue('z', 'Z', 40)]
    const resolved = resolveShortlistVenues(['x', 'missing', 'z'], catalog)
    expect(resolved.venues.map((v) => v.id)).toEqual(['x', 'z'])
    expect(resolved.missingIds).toEqual(['missing'])
    expect(buildShortlistShareText(resolved.venues)).toContain('X')
  })
})
