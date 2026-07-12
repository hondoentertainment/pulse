import type { Venue } from './types'
import { normalizeVenueCategoryKey } from './venue-categories'

export type CompletenessField =
  | 'address'
  | 'coordinates'
  | 'category'
  | 'hours'
  | 'phone'
  | 'website'
  | 'dressCode'
  | 'coverCharge'
  | 'accessibility'
  | 'neighborhood'
  | 'priceRange'
  | 'mapsUrl'

export interface CompletenessResult {
  score: number
  filled: CompletenessField[]
  missing: CompletenessField[]
  weightFilled: number
  weightTotal: number
}

/** Field weights — higher = more important for go-tonight decisions. */
const FIELD_WEIGHTS: Record<CompletenessField, number> = {
  address: 12,
  coordinates: 12,
  category: 10,
  hours: 14,
  phone: 6,
  website: 6,
  dressCode: 8,
  coverCharge: 8,
  accessibility: 6,
  neighborhood: 6,
  priceRange: 6,
  mapsUrl: 6,
}

function hasHours(venue: Venue): boolean {
  if (!venue.hours) return false
  return Object.values(venue.hours).some((v) => typeof v === 'string' && v.trim().length > 0)
}

function fieldFilled(venue: Venue, field: CompletenessField): boolean {
  switch (field) {
    case 'address':
      return Boolean(venue.location?.address?.trim())
    case 'coordinates':
      return Number.isFinite(venue.location?.lat) && Number.isFinite(venue.location?.lng)
    case 'category':
      return normalizeVenueCategoryKey(venue.category) !== 'other' || Boolean(venue.categoryKey)
    case 'hours':
      return hasHours(venue)
    case 'phone':
      return Boolean(venue.phone?.trim())
    case 'website':
      return Boolean(venue.website?.trim())
    case 'dressCode':
      return venue.dressCode != null
    case 'coverCharge':
      return venue.coverChargeCents != null || Boolean(venue.coverChargeNote?.trim())
    case 'accessibility':
      return Array.isArray(venue.accessibilityFeatures) && venue.accessibilityFeatures.length > 0
    case 'neighborhood':
      return Boolean(venue.neighborhood?.trim())
    case 'priceRange':
      return venue.priceRange != null
    case 'mapsUrl':
      return Boolean(venue.integrations?.maps?.googleMapsUrl || venue.integrations?.maps?.appleMapsUrl)
    default:
      return false
  }
}

export function scoreVenueCompleteness(venue: Venue): CompletenessResult {
  const filled: CompletenessField[] = []
  const missing: CompletenessField[] = []
  let weightFilled = 0
  let weightTotal = 0

  for (const field of Object.keys(FIELD_WEIGHTS) as CompletenessField[]) {
    const weight = FIELD_WEIGHTS[field]
    weightTotal += weight
    if (fieldFilled(venue, field)) {
      filled.push(field)
      weightFilled += weight
    } else {
      missing.push(field)
    }
  }

  const score = weightTotal === 0 ? 0 : Math.round((weightFilled / weightTotal) * 100)
  return { score, filled, missing, weightFilled, weightTotal }
}

export function rankVenuesByCompleteness(venues: Venue[], ascending = true): Venue[] {
  return [...venues].sort((a, b) => {
    const sa = scoreVenueCompleteness(a).score
    const sb = scoreVenueCompleteness(b).score
    return ascending ? sa - sb : sb - sa
  })
}

export function cityCompletenessSummary(venues: Venue[]): {
  count: number
  averageScore: number
  pctWithHours: number
  pctWithDress: number
  pctWithAccessibility: number
  pctWithPriceRange: number
} {
  if (venues.length === 0) {
    return {
      count: 0,
      averageScore: 0,
      pctWithHours: 0,
      pctWithDress: 0,
      pctWithAccessibility: 0,
      pctWithPriceRange: 0,
    }
  }
  let total = 0
  let hours = 0
  let dress = 0
  let a11y = 0
  let price = 0
  for (const v of venues) {
    const r = scoreVenueCompleteness(v)
    total += r.score
    if (!r.missing.includes('hours')) hours += 1
    if (!r.missing.includes('dressCode')) dress += 1
    if (!r.missing.includes('accessibility')) a11y += 1
    if (!r.missing.includes('priceRange')) price += 1
  }
  const n = venues.length
  return {
    count: n,
    averageScore: Math.round(total / n),
    pctWithHours: Math.round((hours / n) * 100),
    pctWithDress: Math.round((dress / n) * 100),
    pctWithAccessibility: Math.round((a11y / n) * 100),
    pctWithPriceRange: Math.round((price / n) * 100),
  }
}
