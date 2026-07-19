import { describe, it, expect } from 'vitest'
import {
  normalizeShortlistVenueIds,
  parseShortlistVenueIds,
  parseShortlistVotes,
  applyShortlistVote,
  leadingShortlistVenueId,
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

  it('parses vote tallies scoped to shortlist venues', () => {
    expect(parseShortlistVotes('v=a,b&go=a:2,b:1')).toEqual({ a: 2, b: 1 })
    expect(parseShortlistVotes('go=a:2,intruder:5', ['a', 'b'])).toEqual({ a: 2 })
    expect(parseShortlistVotes('go=a:zero,b:-3,c:')).toEqual({})
  })

  it('applies votes immutably and finds the leader', () => {
    const votes = applyShortlistVote({}, 'a', 1)
    expect(votes).toEqual({ a: 1 })
    const more = applyShortlistVote(applyShortlistVote(votes, 'b', 1), 'b', 1)
    expect(more).toEqual({ a: 1, b: 2 })
    expect(leadingShortlistVenueId(more)).toBe('b')
    expect(applyShortlistVote(votes, 'a', -1)).toEqual({})
    expect(leadingShortlistVenueId({})).toBeNull()
  })

  it('encodes votes into the share path and text', () => {
    expect(buildShortlistPath(['x', 'y'], { x: 2 })).toBe('/shortlist?v=x,y&go=x:2')
    expect(buildShortlistPath(['x'], {})).toBe('/shortlist?v=x')
    const text = buildShortlistShareText([venue('x', 'X', 80)], { x: 3 })
    expect(text).toContain('3 say go')
  })
})
