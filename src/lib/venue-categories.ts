/**
 * Canonical venue category taxonomy.
 * Display labels stay human-readable; keys drive filters and scoring.
 */

export const VENUE_CATEGORY_KEYS = [
  'bar',
  'cocktail_bar',
  'lounge',
  'nightclub',
  'music_venue',
  'brewery',
  'wine_bar',
  'restaurant',
  'cafe',
  'gallery',
  'other',
] as const

export type VenueCategoryKey = (typeof VENUE_CATEGORY_KEYS)[number]

export const VENUE_CATEGORY_LABELS: Record<VenueCategoryKey, string> = {
  bar: 'Bar',
  cocktail_bar: 'Cocktail Bar',
  lounge: 'Lounge',
  nightclub: 'Nightclub',
  music_venue: 'Music Venue',
  brewery: 'Brewery',
  wine_bar: 'Wine Bar',
  restaurant: 'Restaurant',
  cafe: 'Café',
  gallery: 'Gallery',
  other: 'Other',
}

/** Maps free-text / legacy category strings → canonical key. */
export function normalizeVenueCategoryKey(category?: string | null): VenueCategoryKey {
  if (!category) return 'other'
  const lower = category.toLowerCase().trim()

  if (
    lower.includes('café') ||
    lower.includes('cafe') ||
    lower.includes('coffee') ||
    lower === 'cafes' ||
    lower.includes('bakery') ||
    lower.includes('brunch')
  ) {
    return 'cafe'
  }
  if (lower.includes('nightclub') || lower.includes('dance club') || lower === 'nightlife') {
    return 'nightclub'
  }
  if (lower.includes('music') || lower.includes('theatre') || lower.includes('theater')) {
    return 'music_venue'
  }
  if (lower.includes('cocktail')) return 'cocktail_bar'
  if (lower.includes('wine')) return 'wine_bar'
  if (lower.includes('lounge')) return 'lounge'
  if (lower.includes('brewery') || lower.includes('brewpub')) return 'brewery'
  if (lower.includes('restaurant') || lower === 'food') return 'restaurant'
  if (lower.includes('gallery')) return 'gallery'
  if (
    lower.includes('bar') ||
    lower.includes('pub') ||
    lower.includes('tavern') ||
    lower.includes('speakeasy')
  ) {
    return 'bar'
  }
  if ((VENUE_CATEGORY_KEYS as readonly string[]).includes(lower)) {
    return lower as VenueCategoryKey
  }
  return 'other'
}

export function venueCategoryLabel(category?: string | null): string {
  const key = normalizeVenueCategoryKey(category)
  return VENUE_CATEGORY_LABELS[key]
}

/** Scoring engine keys (subset) used by time-contextual scoring. */
export function toScoringCategoryKey(category?: string | null): string {
  const key = normalizeVenueCategoryKey(category)
  if (key === 'cocktail_bar' || key === 'wine_bar' || key === 'lounge') return 'bar'
  if (key === 'other') return 'bar'
  return key
}
