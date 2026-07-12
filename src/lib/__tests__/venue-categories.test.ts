import { describe, it, expect } from 'vitest'
import {
  VENUE_CATEGORY_KEYS,
  VENUE_CATEGORY_LABELS,
  normalizeVenueCategoryKey,
  venueCategoryLabel,
  toScoringCategoryKey,
} from '../venue-categories'

describe('normalizeVenueCategoryKey', () => {
  it('falls back to other for empty input', () => {
    expect(normalizeVenueCategoryKey(undefined)).toBe('other')
    expect(normalizeVenueCategoryKey(null)).toBe('other')
    expect(normalizeVenueCategoryKey('')).toBe('other')
  })

  it('maps cafe variants', () => {
    expect(normalizeVenueCategoryKey('Café')).toBe('cafe')
    expect(normalizeVenueCategoryKey('Coffee Shop')).toBe('cafe')
    expect(normalizeVenueCategoryKey('Bakery')).toBe('cafe')
  })

  it('maps nightlife variants', () => {
    expect(normalizeVenueCategoryKey('Nightclub')).toBe('nightclub')
    expect(normalizeVenueCategoryKey('Dance Club')).toBe('nightclub')
    expect(normalizeVenueCategoryKey('nightlife')).toBe('nightclub')
  })

  it('maps music venue variants', () => {
    expect(normalizeVenueCategoryKey('Music Venue')).toBe('music_venue')
    expect(normalizeVenueCategoryKey('Theatre')).toBe('music_venue')
  })

  it('maps bar-family categories distinctly', () => {
    expect(normalizeVenueCategoryKey('Cocktail Lounge')).toBe('cocktail_bar')
    expect(normalizeVenueCategoryKey('Wine Bar')).toBe('wine_bar')
    expect(normalizeVenueCategoryKey('Lounge')).toBe('lounge')
    expect(normalizeVenueCategoryKey('Speakeasy')).toBe('bar')
    expect(normalizeVenueCategoryKey('Pub')).toBe('bar')
  })

  it('maps brewery, restaurant, and gallery', () => {
    expect(normalizeVenueCategoryKey('Brewpub')).toBe('brewery')
    expect(normalizeVenueCategoryKey('Restaurant')).toBe('restaurant')
    expect(normalizeVenueCategoryKey('Art Gallery')).toBe('gallery')
  })

  it('passes through an already-canonical key', () => {
    expect(normalizeVenueCategoryKey('bar')).toBe('bar')
  })

  it('falls back to other for unrecognized text', () => {
    expect(normalizeVenueCategoryKey('Laundromat')).toBe('other')
  })
})

describe('venueCategoryLabel', () => {
  it('returns the human-readable label for every canonical key', () => {
    for (const key of VENUE_CATEGORY_KEYS) {
      expect(venueCategoryLabel(key)).toBe(VENUE_CATEGORY_LABELS[key])
    }
  })

  it('resolves free-text categories to the right label', () => {
    expect(venueCategoryLabel('Dance Club')).toBe('Nightclub')
  })
})

describe('toScoringCategoryKey', () => {
  it('collapses cocktail/wine/lounge/other into bar', () => {
    expect(toScoringCategoryKey('Cocktail Lounge')).toBe('bar')
    expect(toScoringCategoryKey('Wine Bar')).toBe('bar')
    expect(toScoringCategoryKey('Lounge')).toBe('bar')
    expect(toScoringCategoryKey('Laundromat')).toBe('bar')
  })

  it('keeps other scoring categories distinct', () => {
    expect(toScoringCategoryKey('Nightclub')).toBe('nightclub')
    expect(toScoringCategoryKey('Music Venue')).toBe('music_venue')
    expect(toScoringCategoryKey('Brewery')).toBe('brewery')
    expect(toScoringCategoryKey('Restaurant')).toBe('restaurant')
    expect(toScoringCategoryKey('Café')).toBe('cafe')
    expect(toScoringCategoryKey('Gallery')).toBe('gallery')
    expect(toScoringCategoryKey('Bar')).toBe('bar')
  })
})
