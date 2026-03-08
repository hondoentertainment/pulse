import type { Venue, Pulse, EnergyRating } from './types'

/**
 * Time-Contextual Scoring Engine
 *
 * Normalizes venue scores relative to expected activity for their category
 * at the current time of day. Prevents cafes from always losing to nightlife
 * in raw score comparisons.
 */

export type VenueCategory =
  | 'Café' | 'Coffee' | 'Bakery' | 'Brunch'
  | 'Bar' | 'Lounge' | 'Brewery' | 'Wine Bar'
  | 'Nightclub' | 'Dance Club'
  | 'Music Venue'
  | 'Restaurant'
  | 'Gallery'
  | 'food' | 'nightlife' | 'music' | 'cafes'

export type TimeOfDay = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night'
export type DayType = 'weekday' | 'weekend'

interface PeakHourConfig {
  /** Multiplier applied to raw score during this time block */
  multiplier: number
  /** Expected baseline activity (0-100) for this time */
  expectedBaseline: number
}

/**
 * Category-specific peak hour configurations.
 * Maps category -> time of day -> config.
 * Higher multiplier = this is peak time for this category.
 */
const PEAK_HOURS: Record<string, Record<TimeOfDay, PeakHourConfig>> = {
  cafe: {
    early_morning: { multiplier: 1.8, expectedBaseline: 30 },
    morning:       { multiplier: 2.0, expectedBaseline: 50 },
    afternoon:     { multiplier: 1.4, expectedBaseline: 35 },
    evening:       { multiplier: 0.8, expectedBaseline: 15 },
    night:         { multiplier: 0.5, expectedBaseline: 5 },
    late_night:    { multiplier: 0.3, expectedBaseline: 0 },
  },
  restaurant: {
    early_morning: { multiplier: 0.5, expectedBaseline: 5 },
    morning:       { multiplier: 1.0, expectedBaseline: 20 },
    afternoon:     { multiplier: 1.5, expectedBaseline: 40 },
    evening:       { multiplier: 2.0, expectedBaseline: 60 },
    night:         { multiplier: 1.2, expectedBaseline: 30 },
    late_night:    { multiplier: 0.5, expectedBaseline: 5 },
  },
  bar: {
    early_morning: { multiplier: 0.2, expectedBaseline: 0 },
    morning:       { multiplier: 0.3, expectedBaseline: 0 },
    afternoon:     { multiplier: 0.8, expectedBaseline: 15 },
    evening:       { multiplier: 1.5, expectedBaseline: 40 },
    night:         { multiplier: 2.0, expectedBaseline: 70 },
    late_night:    { multiplier: 1.8, expectedBaseline: 50 },
  },
  nightclub: {
    early_morning: { multiplier: 0.1, expectedBaseline: 0 },
    morning:       { multiplier: 0.1, expectedBaseline: 0 },
    afternoon:     { multiplier: 0.2, expectedBaseline: 0 },
    evening:       { multiplier: 0.8, expectedBaseline: 15 },
    night:         { multiplier: 2.0, expectedBaseline: 80 },
    late_night:    { multiplier: 2.5, expectedBaseline: 90 },
  },
  music_venue: {
    early_morning: { multiplier: 0.1, expectedBaseline: 0 },
    morning:       { multiplier: 0.2, expectedBaseline: 0 },
    afternoon:     { multiplier: 0.5, expectedBaseline: 10 },
    evening:       { multiplier: 1.5, expectedBaseline: 50 },
    night:         { multiplier: 2.0, expectedBaseline: 75 },
    late_night:    { multiplier: 1.5, expectedBaseline: 40 },
  },
  brewery: {
    early_morning: { multiplier: 0.2, expectedBaseline: 0 },
    morning:       { multiplier: 0.3, expectedBaseline: 5 },
    afternoon:     { multiplier: 1.5, expectedBaseline: 40 },
    evening:       { multiplier: 2.0, expectedBaseline: 60 },
    night:         { multiplier: 1.2, expectedBaseline: 30 },
    late_night:    { multiplier: 0.5, expectedBaseline: 5 },
  },
  gallery: {
    early_morning: { multiplier: 0.3, expectedBaseline: 0 },
    morning:       { multiplier: 0.8, expectedBaseline: 15 },
    afternoon:     { multiplier: 2.0, expectedBaseline: 50 },
    evening:       { multiplier: 1.5, expectedBaseline: 40 },
    night:         { multiplier: 0.8, expectedBaseline: 15 },
    late_night:    { multiplier: 0.3, expectedBaseline: 0 },
  },
}

/** Map display categories to normalized keys (exported for use by recommendations) */
export function normalizeCategoryKeyPublic(category?: string): string {
  return normalizeCategoryKey(category)
}

function normalizeCategoryKey(category?: string): string {
  if (!category) return 'bar'
  const lower = category.toLowerCase()
  if (lower.includes('café') || lower.includes('cafe') || lower.includes('coffee') || lower === 'cafes' || lower.includes('bakery') || lower.includes('brunch'))
    return 'cafe'
  if (lower.includes('nightclub') || lower.includes('dance club') || lower === 'nightlife')
    return 'nightclub'
  if (lower.includes('music') || lower.includes('theatre') || lower.includes('theater'))
    return 'music_venue'
  if (lower.includes('restaurant') || lower === 'food')
    return 'restaurant'
  if (lower.includes('brewery'))
    return 'brewery'
  if (lower.includes('gallery'))
    return 'gallery'
  if (lower.includes('lounge') || lower.includes('wine'))
    return 'bar'
  return 'bar'
}

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours()
  if (hour >= 5 && hour < 7) return 'early_morning'
  if (hour >= 7 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  if (hour >= 21 && hour < 24) return 'night'
  return 'late_night' // 0-5
}

export function getDayType(date: Date = new Date()): DayType {
  const day = date.getDay()
  return day === 0 || day === 6 ? 'weekend' : 'weekday'
}

function getDayName(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

function getTimeLabel(tod: TimeOfDay): string {
  switch (tod) {
    case 'early_morning': return 'early morning'
    case 'morning': return 'morning'
    case 'afternoon': return 'afternoon'
    case 'evening': return 'evening'
    case 'night': return 'night'
    case 'late_night': return 'late night'
  }
}

/**
 * Get the peak hour config for a venue category at the current time.
 */
export function getPeakConfig(category?: string, date?: Date): PeakHourConfig {
  const key = normalizeCategoryKey(category)
  const tod = getTimeOfDay(date)
  return PEAK_HOURS[key]?.[tod] ?? { multiplier: 1.0, expectedBaseline: 30 }
}

/**
 * Calculate a time-contextual score that normalizes raw pulse score
 * relative to expected activity for this venue's category and time.
 *
 * A cafe with 30 pulse score at 8am is actually impressive (normalized ~60),
 * while a nightclub with 30 at 8am is expected to be dead (normalized ~15).
 */
export function calculateContextualScore(venue: Venue, date?: Date): number {
  const config = getPeakConfig(venue.category, date)
  const raw = venue.pulseScore

  // Normalize: how is this venue performing relative to expected?
  // If raw > expected baseline, boost it. If below, dampen it.
  const baselineRatio = config.expectedBaseline > 0
    ? raw / config.expectedBaseline
    : raw > 0 ? 2.0 : 0

  // Apply time multiplier: venues in their peak hours get boosted
  const contextual = raw * config.multiplier * Math.min(baselineRatio, 2.0)

  // Blend: 60% contextual, 40% raw to avoid completely distorting rankings
  const blended = contextual * 0.6 + raw * 0.4

  return Math.min(100, Math.round(blended))
}

/**
 * Generate a contextual energy label like:
 * "Electric for a Tuesday afternoon" or "Heating up early"
 */
export function getContextualLabel(venue: Venue, date: Date = new Date()): string {
  const config = getPeakConfig(venue.category, date)
  const raw = venue.pulseScore
  const dayName = getDayName(date)
  const todLabel = getTimeLabel(getTimeOfDay(date))

  // Venue is active during an off-peak time
  if (config.multiplier < 1.0 && raw >= 40) {
    return `Surprisingly busy for a ${dayName} ${todLabel}`
  }

  // Venue is surging well above expected baseline
  if (raw > config.expectedBaseline * 1.5 && config.expectedBaseline > 0) {
    if (raw >= 75) return `Electric for a ${dayName} ${todLabel}`
    if (raw >= 50) return `Heating up early`
    return `More active than usual`
  }

  // Venue is meeting expectations during peak
  if (config.multiplier >= 1.5 && raw >= config.expectedBaseline) {
    if (raw >= 75) return `Peak energy right now`
    if (raw >= 50) return `Right on schedule`
    return ''
  }

  // Venue is underperforming during its peak time
  if (config.multiplier >= 1.5 && raw < config.expectedBaseline * 0.5 && config.expectedBaseline > 20) {
    return `Quieter than usual for ${todLabel}`
  }

  return ''
}

/**
 * Sort venues using time-contextual scoring so cafes can surface
 * in morning feeds and bars surface in evening feeds.
 */
export function sortByContextualScore(venues: Venue[], date?: Date): Venue[] {
  return [...venues].sort((a, b) => {
    const scoreA = calculateContextualScore(a, date)
    const scoreB = calculateContextualScore(b, date)
    return scoreB - scoreA
  })
}

/**
 * Get time-appropriate category suggestions.
 * Returns categories that are in their peak hours right now.
 */
export function getPeakCategories(date: Date = new Date()): string[] {
  const tod = getTimeOfDay(date)
  const results: { key: string; label: string; multiplier: number }[] = []

  const categoryLabels: Record<string, string> = {
    cafe: 'Cafes & Coffee',
    restaurant: 'Restaurants',
    bar: 'Bars & Lounges',
    nightclub: 'Nightclubs',
    music_venue: 'Live Music',
    brewery: 'Breweries',
    gallery: 'Galleries',
  }

  for (const [key, hours] of Object.entries(PEAK_HOURS)) {
    const config = hours[tod]
    if (config.multiplier >= 1.5) {
      results.push({ key, label: categoryLabels[key] ?? key, multiplier: config.multiplier })
    }
  }

  return results
    .sort((a, b) => b.multiplier - a.multiplier)
    .map(r => r.label)
}
