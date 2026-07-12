/**
 * Server-side venue data-completeness scoring.
 *
 * Mirrors `src/lib/venue-completeness.ts` but works against plain Supabase
 * row objects (snake_case columns) instead of the client `Venue` domain type,
 * so `api/admin/venues-completeness.ts` doesn't need to import from `src/`
 * (keeps the Vercel function bundle independent of the Vite app).
 */

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

/** Minimal shape of a `venues` row needed for scoring. Extra columns are ignored. */
export interface VenueRow {
  id?: string
  name?: string | null
  location_address?: string | null
  location_lat?: number | null
  location_lng?: number | null
  category?: string | null
  category_key?: string | null
  hours?: Record<string, unknown> | null
  phone?: string | null
  website?: string | null
  dress_code?: string | null
  cover_charge_cents?: number | null
  cover_charge_note?: string | null
  accessibility_features?: string[] | null
  neighborhood?: string | null
  price_range?: number | null
  integrations?: { maps?: { googleMapsUrl?: string; appleMapsUrl?: string } } | null
}

/** Field weights — mirrors `src/lib/venue-completeness.ts`. */
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

function hasHours(row: VenueRow): boolean {
  if (!row.hours || typeof row.hours !== 'object') return false
  return Object.values(row.hours).some((v) => typeof v === 'string' && v.trim().length > 0)
}

function fieldFilled(row: VenueRow, field: CompletenessField): boolean {
  switch (field) {
    case 'address':
      return Boolean(row.location_address?.trim())
    case 'coordinates':
      return Number.isFinite(row.location_lat) && Number.isFinite(row.location_lng)
    case 'category':
      return Boolean(row.category_key?.trim()) && row.category_key !== 'other'
    case 'hours':
      return hasHours(row)
    case 'phone':
      return Boolean(row.phone?.trim())
    case 'website':
      return Boolean(row.website?.trim())
    case 'dressCode':
      return row.dress_code != null
    case 'coverCharge':
      return row.cover_charge_cents != null || Boolean(row.cover_charge_note?.trim())
    case 'accessibility':
      return Array.isArray(row.accessibility_features) && row.accessibility_features.length > 0
    case 'neighborhood':
      return Boolean(row.neighborhood?.trim())
    case 'priceRange':
      return row.price_range != null
    case 'mapsUrl':
      return Boolean(row.integrations?.maps?.googleMapsUrl || row.integrations?.maps?.appleMapsUrl)
    default:
      return false
  }
}

export function scoreVenueRowCompleteness(row: VenueRow): CompletenessResult {
  const filled: CompletenessField[] = []
  const missing: CompletenessField[] = []
  let weightFilled = 0
  let weightTotal = 0

  for (const field of Object.keys(FIELD_WEIGHTS) as CompletenessField[]) {
    const weight = FIELD_WEIGHTS[field]
    weightTotal += weight
    if (fieldFilled(row, field)) {
      filled.push(field)
      weightFilled += weight
    } else {
      missing.push(field)
    }
  }

  const score = weightTotal === 0 ? 0 : Math.round((weightFilled / weightTotal) * 100)
  return { score, filled, missing, weightFilled, weightTotal }
}

export function rankVenueRowsByCompleteness(rows: VenueRow[], ascending = true): VenueRow[] {
  return [...rows].sort((a, b) => {
    const sa = scoreVenueRowCompleteness(a).score
    const sb = scoreVenueRowCompleteness(b).score
    return ascending ? sa - sb : sb - sa
  })
}

export interface CityCompletenessSummary {
  count: number
  averageScore: number
  pctWithHours: number
  pctWithDress: number
  pctWithAccessibility: number
  pctWithPriceRange: number
}

export function cityRowCompletenessSummary(rows: VenueRow[]): CityCompletenessSummary {
  if (rows.length === 0) {
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
  for (const row of rows) {
    const r = scoreVenueRowCompleteness(row)
    total += r.score
    if (!r.missing.includes('hours')) hours += 1
    if (!r.missing.includes('dressCode')) dress += 1
    if (!r.missing.includes('accessibility')) a11y += 1
    if (!r.missing.includes('priceRange')) price += 1
  }
  const n = rows.length
  return {
    count: n,
    averageScore: Math.round(total / n),
    pctWithHours: Math.round((hours / n) * 100),
    pctWithDress: Math.round((dress / n) * 100),
    pctWithAccessibility: Math.round((a11y / n) * 100),
    pctWithPriceRange: Math.round((price / n) * 100),
  }
}
