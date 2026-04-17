import type { Venue, User } from './types'
import {
  type TimeOfDay,
  type DayType,
  getPeakConfig,
  normalizeCategoryKeyPublic,
} from './time-contextual-scoring'
import { buildCategoryPreferences } from './venue-recommendations'
import { calculateDistance } from './pulse-engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeatherCondition = 'clear' | 'rain' | 'snow' | 'hot'

export interface AdaptiveLayoutConfig {
  primaryCategory: string
  secondaryCategories: string[]
  headerLabel: string
  greeting: string
  tagline: string
}

export interface ContextualSearchSuggestion {
  query: string
  label: string
  categoryKey: string
  buzzingCount: number
}

export interface WeatherVenueTag {
  type: 'indoor' | 'outdoor' | 'patio' | 'rooftop'
  weatherSafe: boolean
  label: string
}

// ---------------------------------------------------------------------------
// Category display labels
// ---------------------------------------------------------------------------

const CATEGORY_DISPLAY: Record<string, string> = {
  cafe: 'Cafes & Coffee',
  restaurant: 'Restaurants',
  bar: 'Bars & Lounges',
  nightclub: 'Nightclubs',
  music_venue: 'Live Music',
  brewery: 'Breweries',
  gallery: 'Galleries',
}

const CATEGORY_SEARCH_TERMS: Record<string, string> = {
  cafe: 'coffee shops',
  restaurant: 'restaurants',
  bar: 'bars',
  nightclub: 'clubs',
  music_venue: 'live music venues',
  brewery: 'breweries',
  gallery: 'galleries',
}

// ---------------------------------------------------------------------------
// Venue setting inference
// ---------------------------------------------------------------------------

function inferVenueSetting(venue: Venue): 'indoor' | 'outdoor' | 'patio' | 'rooftop' {
  const name = (venue.name ?? '').toLowerCase()
  const category = (venue.category ?? '').toLowerCase()

  if (name.includes('rooftop') || name.includes('sky')) return 'rooftop'
  if (name.includes('patio') || name.includes('garden') || name.includes('terrace')) return 'patio'
  if (name.includes('park') || name.includes('outdoor') || name.includes('beach')) return 'outdoor'
  if (category.includes('food truck') || category.includes('market')) return 'outdoor'
  return 'indoor'
}

// ---------------------------------------------------------------------------
// 1. getTimeContextualLabel
// ---------------------------------------------------------------------------

/**
 * Returns a short, human-readable contextual label for a venue based on
 * the current time of day and day type. Useful for badge/pill overlays.
 */
export function getTimeContextualLabel(
  venue: Venue,
  timeOfDay: TimeOfDay,
  dayType: DayType,
): string {
  const catKey = normalizeCategoryKeyPublic(venue.category)
  const config = getPeakConfig(venue.category)

  // Weekend brunch
  if (
    dayType === 'weekend' &&
    (timeOfDay === 'morning' || timeOfDay === 'early_morning') &&
    (catKey === 'cafe' || catKey === 'restaurant')
  ) {
    return 'Sunday brunch favorite'
  }

  // Happy hour window
  if (timeOfDay === 'evening' && (catKey === 'bar' || catKey === 'brewery')) {
    return 'Happy hour spot'
  }

  // Late night pick
  if (
    (timeOfDay === 'late_night' || timeOfDay === 'night') &&
    (catKey === 'nightclub' || catKey === 'bar')
  ) {
    return 'Late night pick'
  }

  // Peak hour for category
  if (config.multiplier >= 1.5) {
    const display = CATEGORY_DISPLAY[catKey] ?? venue.category ?? 'venues'
    return `Peak hour for ${display.toLowerCase()}`
  }

  // Morning coffee
  if (
    (timeOfDay === 'early_morning' || timeOfDay === 'morning') &&
    catKey === 'cafe'
  ) {
    return 'Morning coffee spot'
  }

  // Dinner rush
  if (timeOfDay === 'evening' && catKey === 'restaurant') {
    return 'Dinner hour'
  }

  // Gallery afternoon
  if (timeOfDay === 'afternoon' && catKey === 'gallery') {
    return 'Afternoon culture'
  }

  return ''
}

// ---------------------------------------------------------------------------
// 2. getSmartVenueSort
// ---------------------------------------------------------------------------

/**
 * Re-ranks venues combining time-contextual relevance, category preference,
 * and user check-in history into a single composite score.
 */
export function getSmartVenueSort(
  venues: Venue[],
  user: User,
  timeOfDay: TimeOfDay,
  dayType: DayType,
): Venue[] {
  const prefs = buildCategoryPreferences(user, venues)
  const history = user.venueCheckInHistory ?? {}
  const favoriteSet = new Set(user.favoriteVenues ?? [])

  const scored = venues.map((venue) => {
    let score = 0
    const catKey = normalizeCategoryKeyPublic(venue.category)
    const config = getPeakConfig(venue.category)

    // Time relevance (0-40): boost venues in their peak hours
    score += config.multiplier * 16 // max ~40 for multiplier=2.5

    // Category preference (0-25): user historically prefers this type
    const prefWeight = prefs[catKey] ?? 0
    score += prefWeight * 25

    // Raw pulse score (0-20): currently active venues
    score += (venue.pulseScore / 100) * 20

    // Check-in loyalty (0-10): venues the user returns to
    const checkIns = history[venue.id] ?? 0
    score += Math.min(10, checkIns * 2)

    // Favorite bonus (5 flat)
    if (favoriteSet.has(venue.id)) {
      score += 5
    }

    // Weekend-specific boosts
    if (dayType === 'weekend') {
      if (
        (timeOfDay === 'morning' || timeOfDay === 'early_morning') &&
        (catKey === 'cafe' || catKey === 'restaurant')
      ) {
        score += 8 // brunch boost
      }
      if (
        (timeOfDay === 'night' || timeOfDay === 'late_night') &&
        catKey === 'nightclub'
      ) {
        score += 10 // weekend nightlife boost
      }
    }

    return { venue, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.venue)
}

// ---------------------------------------------------------------------------
// 3. getContextualSearchSuggestions
// ---------------------------------------------------------------------------

/**
 * Returns 3-5 contextual search suggestions with buzzing venue counts.
 * Example: "rooftop bars — 3 buzzing near you"
 */
export function getContextualSearchSuggestions(
  venues: Venue[],
  userLocation: { lat: number; lng: number } | null,
  timeOfDay: TimeOfDay,
): ContextualSearchSuggestion[] {
  const suggestions: ContextualSearchSuggestion[] = []

  // Build counts per normalized category
  const catCounts: Record<string, { total: number; buzzing: number }> = {}
  for (const venue of venues) {
    const key = normalizeCategoryKeyPublic(venue.category)
    if (!catCounts[key]) catCounts[key] = { total: 0, buzzing: 0 }
    catCounts[key].total++

    // Count buzzing nearby venues
    const isBuzzing = venue.pulseScore >= 50
    const isNearby =
      !userLocation ||
      calculateDistance(
        userLocation.lat,
        userLocation.lng,
        venue.location.lat,
        venue.location.lng,
      ) <= 5
    if (isBuzzing && isNearby) {
      catCounts[key].buzzing++
    }
  }

  // Priority categories based on time of day
  const timePriority: Record<TimeOfDay, string[]> = {
    early_morning: ['cafe'],
    morning: ['cafe', 'restaurant'],
    afternoon: ['restaurant', 'brewery', 'gallery', 'cafe'],
    evening: ['bar', 'restaurant', 'music_venue', 'brewery'],
    night: ['bar', 'nightclub', 'music_venue'],
    late_night: ['nightclub', 'bar'],
  }

  const prioritized = timePriority[timeOfDay] ?? ['bar', 'restaurant']

  for (const catKey of prioritized) {
    const counts = catCounts[catKey]
    if (!counts) continue

    const searchTerm = CATEGORY_SEARCH_TERMS[catKey] ?? catKey
    const buzzCount = counts.buzzing

    const label =
      buzzCount > 0
        ? `${searchTerm} \u2014 ${buzzCount} buzzing near you`
        : `${searchTerm} nearby`

    suggestions.push({
      query: searchTerm,
      label,
      categoryKey: catKey,
      buzzingCount: buzzCount,
    })

    if (suggestions.length >= 5) break
  }

  // Add a time-contextual wildcard suggestion if we have room
  if (suggestions.length < 5) {
    if (timeOfDay === 'evening' || timeOfDay === 'night') {
      const allBuzzing = venues.filter((v) => v.pulseScore >= 50).length
      if (allBuzzing > 0) {
        suggestions.push({
          query: 'buzzing right now',
          label: `buzzing right now \u2014 ${allBuzzing} spots lit up`,
          categoryKey: 'all',
          buzzingCount: allBuzzing,
        })
      }
    }
    if (timeOfDay === 'morning' || timeOfDay === 'early_morning') {
      suggestions.push({
        query: 'open now',
        label: 'open now near you',
        categoryKey: 'all',
        buzzingCount: 0,
      })
    }
  }

  return suggestions.slice(0, 5)
}

// ---------------------------------------------------------------------------
// 4. getAdaptiveLayout
// ---------------------------------------------------------------------------

/**
 * Returns a layout configuration that adapts the home screen to the current
 * time and day context.
 */
export function getAdaptiveLayout(
  timeOfDay: TimeOfDay,
  dayType: DayType,
): AdaptiveLayoutConfig {
  const peakCats = getPeakCategories()
  const primary = peakCats[0] ?? 'Bars & Lounges'
  const secondary = peakCats.slice(1, 4)

  const greetings: Record<TimeOfDay, string> = {
    early_morning: 'Early bird',
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    night: 'Tonight',
    late_night: 'Late night?',
  }

  const taglines: Record<TimeOfDay, Record<DayType, string>> = {
    early_morning: {
      weekday: 'Coffee spots are waking up',
      weekend: 'Early brunch spots are stirring',
    },
    morning: {
      weekday: 'Start your day right',
      weekend: 'Brunch spots are buzzing',
    },
    afternoon: {
      weekday: 'Lunch break? Here\'s what\'s hot',
      weekend: 'The afternoon is heating up',
    },
    evening: {
      weekday: 'Happy hour is calling',
      weekend: 'The night is just getting started',
    },
    night: {
      weekday: 'See what\'s popping tonight',
      weekend: 'The city is alive tonight',
    },
    late_night: {
      weekday: 'Still going? So are these spots',
      weekend: 'The night is still young',
    },
  }

  return {
    primaryCategory: primary,
    secondaryCategories: secondary,
    headerLabel: primary,
    greeting: greetings[timeOfDay],
    tagline: taglines[timeOfDay]?.[dayType] ?? 'See what\'s happening',
  }
}

// ---------------------------------------------------------------------------
// 5. getWeatherAwareFilter
// ---------------------------------------------------------------------------

/**
 * Annotates venues with weather-appropriate tags and optionally filters
 * out weather-unsafe venues. Returns all venues with tags; consumers can
 * use the `weatherSafe` flag to filter further.
 */
export function getWeatherAwareFilter(
  venues: Venue[],
  conditions: WeatherCondition,
): Array<{ venue: Venue; weatherTag: WeatherVenueTag }> {
  return venues.map((venue) => {
    const setting = inferVenueSetting(venue)

    let weatherSafe: boolean
    let label: string

    switch (conditions) {
      case 'rain':
        weatherSafe = setting === 'indoor'
        label =
          setting === 'indoor'
            ? 'Indoor \u2014 rain safe'
            : setting === 'rooftop'
              ? 'Rooftop \u2014 check cover'
              : setting === 'patio'
                ? 'Patio \u2014 may be covered'
                : 'Outdoor \u2014 rain exposed'
        break
      case 'snow':
        weatherSafe = setting === 'indoor'
        label =
          setting === 'indoor'
            ? 'Indoor \u2014 cozy pick'
            : 'Outdoor \u2014 bundle up'
        break
      case 'hot':
        weatherSafe = setting === 'indoor' || setting === 'rooftop'
        label =
          setting === 'indoor'
            ? 'Indoor \u2014 AC escape'
            : setting === 'rooftop'
              ? 'Rooftop \u2014 breezy'
              : setting === 'patio'
                ? 'Patio \u2014 shade check'
                : 'Outdoor \u2014 bring water'
        break
      case 'clear':
      default:
        weatherSafe = true
        label =
          setting === 'rooftop'
            ? 'Rooftop \u2014 perfect weather'
            : setting === 'patio'
              ? 'Patio \u2014 enjoy outside'
              : setting === 'outdoor'
                ? 'Outdoor \u2014 great day for it'
                : 'Indoor'
        break
    }

    return {
      venue,
      weatherTag: {
        type: setting,
        weatherSafe,
        label,
      },
    }
  })
}
