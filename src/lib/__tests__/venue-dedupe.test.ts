import { describe, it, expect } from 'vitest'
import {
  findDuplicateGroups,
  haversineMeters,
  levenshteinDistance,
  namesAreSimilar,
  namesMatchExactly,
  normalizeVenueName,
} from '../venue-dedupe'
import type { Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Test Venue',
    location: { lat: 47.6, lng: -122.3, address: '' },
    pulseScore: 50,
    ...overrides,
  }
}

describe('normalizeVenueName', () => {
  it('lowercases, strips punctuation, and drops leading articles', () => {
    expect(normalizeVenueName('The Crocodile')).toBe('crocodile')
    expect(normalizeVenueName("Tula's Restaurant & Jazz Club")).toBe('tula s restaurant jazz club')
  })

  it('strips diacritics', () => {
    expect(normalizeVenueName('Zig Zag Café')).toBe('zig zag cafe')
  })

  it('returns empty string for nullish input', () => {
    expect(normalizeVenueName(undefined)).toBe('')
    expect(normalizeVenueName(null)).toBe('')
    expect(normalizeVenueName('')).toBe('')
  })
})

describe('namesMatchExactly', () => {
  it('matches names that normalize identically', () => {
    expect(namesMatchExactly('The Crocodile', 'Crocodile')).toBe(true)
    expect(namesMatchExactly('Neumos', 'neumos')).toBe(true)
  })

  it('does not match unrelated names', () => {
    expect(namesMatchExactly('Neumos', 'Barboza')).toBe(false)
  })

  it('does not match when both sides are empty', () => {
    expect(namesMatchExactly('', '')).toBe(false)
    expect(namesMatchExactly(undefined, null)).toBe(false)
  })
})

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('bar', 'bar')).toBe(0)
  })

  it('returns the length of the other string when one is empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3)
    expect(levenshteinDistance('abc', '')).toBe(3)
  })

  it('computes edit distance for near-identical strings', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    expect(levenshteinDistance('neumos', 'neumo')).toBe(1)
  })
})

describe('namesAreSimilar', () => {
  it('matches substrings', () => {
    expect(namesAreSimilar('Rumpus Room', 'Rumpus')).toBe(true)
  })

  it('matches minor typos within the edit-ratio threshold', () => {
    expect(namesAreSimilar('Kremwerk', 'Kremwrk')).toBe(true)
  })

  it('does not match unrelated names', () => {
    expect(namesAreSimilar('Neumos', 'Foundation Nightclub')).toBe(false)
  })

  it('returns false when either name is empty', () => {
    expect(namesAreSimilar('', 'Neumos')).toBe(false)
    expect(namesAreSimilar('Neumos', undefined)).toBe(false)
  })
})

describe('haversineMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(haversineMeters(47.6145, -122.3205, 47.6145, -122.3205)).toBeCloseTo(0, 3)
  })

  it('returns a small positive distance for nearby points', () => {
    // Neumos vs Barboza — same building, curated catalog has them ~15m apart.
    const dist = haversineMeters(47.6145, -122.3205, 47.6145, -122.3207)
    expect(dist).toBeGreaterThan(0)
    expect(dist).toBeLessThan(100)
  })

  it('returns a large distance for far-apart points', () => {
    // Seattle vs Portland, roughly.
    const dist = haversineMeters(47.6145, -122.3205, 45.5152, -122.6784)
    expect(dist).toBeGreaterThan(200_000)
  })
})

describe('findDuplicateGroups', () => {
  it('returns no groups for an empty or singleton-only list', () => {
    expect(findDuplicateGroups([])).toEqual([])
    expect(findDuplicateGroups([makeVenue({ id: 'a' })])).toEqual([])
  })

  it('groups venues with exactly matching normalized names', () => {
    const a = makeVenue({ id: 'a', name: 'The Crocodile', location: { lat: 10, lng: 10, address: '' } })
    const b = makeVenue({ id: 'b', name: 'Crocodile', location: { lat: 40, lng: 40, address: '' } })
    const groups = findDuplicateGroups([a, b])
    expect(groups).toHaveLength(1)
    expect(groups[0].venues.map((v) => v.id).sort()).toEqual(['a', 'b'])
    expect(groups[0].reasons).toContain('same_name')
  })

  it('groups venues that are close in proximity with similar names', () => {
    const a = makeVenue({ id: 'a', name: 'Neumos', location: { lat: 47.6145, lng: -122.3205, address: '' } })
    const b = makeVenue({ id: 'b', name: 'Neumos Seattle', location: { lat: 47.61451, lng: -122.32051, address: '' } })
    const groups = findDuplicateGroups([a, b])
    expect(groups).toHaveLength(1)
    expect(groups[0].reasons).toContain('proximity_similar_name')
  })

  it('does not group venues that are close but have dissimilar names', () => {
    const a = makeVenue({ id: 'a', name: 'Neumos', location: { lat: 47.6145, lng: -122.3205, address: '' } })
    const b = makeVenue({ id: 'b', name: 'Barboza', location: { lat: 47.6145, lng: -122.3206, address: '' } })
    expect(findDuplicateGroups([a, b])).toEqual([])
  })

  it('does not group venues that have similar names but are far apart', () => {
    const a = makeVenue({ id: 'a', name: 'The Crocodile Bar', location: { lat: 47.6145, lng: -122.3205, address: '' } })
    const b = makeVenue({ id: 'b', name: 'Crocodile Lounge', location: { lat: 10, lng: 10, address: '' } })
    expect(findDuplicateGroups([a, b])).toEqual([])
  })

  it('merges transitive matches into a single group', () => {
    const a = makeVenue({ id: 'a', name: 'The Crocodile', location: { lat: 1, lng: 1, address: '' } })
    const b = makeVenue({ id: 'b', name: 'Crocodile', location: { lat: 47.6145, lng: -122.3205, address: '' } })
    const c = makeVenue({ id: 'c', name: 'Crocodile Seattle', location: { lat: 47.61451, lng: -122.32052, address: '' } })
    const groups = findDuplicateGroups([a, b, c])
    expect(groups).toHaveLength(1)
    expect(groups[0].venues.map((v) => v.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('skips venues missing coordinates for the proximity check without throwing', () => {
    const a = makeVenue({ id: 'a', name: 'Neumos', location: { lat: undefined as unknown as number, lng: undefined as unknown as number, address: '' } })
    const b = makeVenue({ id: 'b', name: 'Neumos', location: { lat: 47.6145, lng: -122.3205, address: '' } })
    // Still grouped — falls back to the exact-name match, which doesn't need coordinates.
    const groups = findDuplicateGroups([a, b])
    expect(groups).toHaveLength(1)
    expect(groups[0].reasons).toEqual(['same_name'])
  })

  it('is deterministic across repeated calls (stable id + ordering)', () => {
    const a = makeVenue({ id: 'a', name: 'The Crocodile', location: { lat: 47.6145, lng: -122.3205, address: '' } })
    const b = makeVenue({ id: 'b', name: 'Crocodile', location: { lat: 47.6145, lng: -122.3205, address: '' } })
    const c = makeVenue({ id: 'c', name: 'Unrelated Bar', location: { lat: -10, lng: -10, address: '' } })
    const first = findDuplicateGroups([a, b, c])
    const second = findDuplicateGroups([a, b, c])
    expect(first).toEqual(second)
    expect(first).toHaveLength(1)
    expect(first[0].id).toBe('a|b')
  })
})
