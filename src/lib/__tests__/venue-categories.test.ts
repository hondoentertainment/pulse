import { describe, it, expect } from 'vitest'
import { normalizeVenueCategoryKey, venueCategoryLabel } from '../venue-categories'

describe('venue-categories', () => {
  it('normalizes nightlife strings', () => {
    expect(normalizeVenueCategoryKey('Nightclub')).toBe('nightclub')
    expect(normalizeVenueCategoryKey('Music Venue')).toBe('music_venue')
    expect(normalizeVenueCategoryKey('Cocktail Bar')).toBe('cocktail_bar')
  })

  it('returns human labels', () => {
    expect(venueCategoryLabel('nightclub')).toBe('Nightclub')
  })
})
