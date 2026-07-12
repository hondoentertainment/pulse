/**
 * Venue queries backed by Supabase.
 *
 * Intentionally *alongside* the mock-data reads in `src/lib/mock-data.ts` —
 * the backend team can flip call-sites over one at a time. Feature flag
 * `VITE_FF_BACKEND_VENUES` is a reasonable gate once wiring begins.
 */

import { supabase } from '@/lib/supabase'
import { fromAlive, unwrap, unwrapMaybe } from '@/lib/auth/rls-helpers'
import type { AccessibilityFeature, Venue, VenueDressCode, VenueIndoorOutdoor, VenuePriceRange } from '@/lib/types'
import { normalizeVenueCategoryKey } from '@/lib/venue-categories'
import { normalizeDressCode } from '@/lib/dress-code'

// ── Row <-> Domain mapping ───────────────────────────────────────────────
// Keeping a single mapper here so the column renames live in one place.

interface VenueRow {
  id: string
  name: string
  location_lat: number
  location_lng: number
  location_address: string
  city: string | null
  state: string | null
  neighborhood: string | null
  category: string | null
  category_key: string | null
  pulse_score: number | null
  score_velocity: number | null
  last_pulse_at: string | null
  last_activity: string | null
  pre_trending: boolean | null
  pre_trending_label: string | null
  seeded: boolean | null
  verified_check_in_count: number | null
  first_real_check_in_at: string | null
  hours: Venue['hours'] | null
  phone: string | null
  website: string | null
  menu_url: string | null
  integrations: Venue['integrations'] | null
  dress_code: string | null
  cover_charge_cents: number | null
  cover_charge_note: string | null
  accessibility_features: string[] | null
  indoor_outdoor: string | null
  capacity_hint: number | null
  price_range: number | null
  place_id: string | null
  enriched_at: string | null
  deleted_at: string | null
}

function rowToVenue(row: VenueRow): Venue {
  const categoryKey = row.category_key
    ? normalizeVenueCategoryKey(row.category_key)
    : normalizeVenueCategoryKey(row.category)
  return {
    id: row.id,
    name: row.name,
    location: {
      lat: row.location_lat,
      lng: row.location_lng,
      address: row.location_address,
    },
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    neighborhood: row.neighborhood ?? undefined,
    category: row.category ?? undefined,
    categoryKey,
    pulseScore: row.pulse_score ?? 0,
    scoreVelocity: row.score_velocity ?? 0,
    lastPulseAt: row.last_pulse_at ?? undefined,
    lastActivity: row.last_activity ?? undefined,
    preTrending: row.pre_trending ?? undefined,
    preTrendingLabel: row.pre_trending_label ?? undefined,
    seeded: row.seeded ?? undefined,
    verifiedCheckInCount: row.verified_check_in_count ?? undefined,
    firstRealCheckInAt: row.first_real_check_in_at ?? undefined,
    hours: row.hours ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    menuUrl: row.menu_url ?? null,
    integrations: row.integrations ?? undefined,
    dressCode: normalizeDressCode(row.dress_code) as VenueDressCode | null,
    coverChargeCents: row.cover_charge_cents,
    coverChargeNote: row.cover_charge_note,
    accessibilityFeatures: (row.accessibility_features ?? undefined) as AccessibilityFeature[] | undefined,
    indoorOutdoor: (row.indoor_outdoor as VenueIndoorOutdoor | null) ?? null,
    capacityHint: row.capacity_hint,
    priceRange: (row.price_range as VenuePriceRange | null) ?? null,
    placeId: row.place_id,
    enrichedAt: row.enriched_at,
  }
}

const SELECT_COLUMNS = `
  id, name, location_lat, location_lng, location_address,
  city, state, neighborhood, category, category_key, pulse_score, score_velocity,
  last_pulse_at, last_activity, pre_trending, pre_trending_label,
  seeded, verified_check_in_count, first_real_check_in_at,
  hours, phone, website, menu_url, integrations,
  dress_code, cover_charge_cents, cover_charge_note, accessibility_features,
  indoor_outdoor, capacity_hint, price_range, place_id, enriched_at, deleted_at
`.trim()

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Fetch all visible venues. Large result sets should use `listNearby`.
 */
export async function listVenues(limit = 500): Promise<Venue[]> {
  const result = await fromAlive('venues', SELECT_COLUMNS)
    .order('pulse_score', { ascending: false })
    .limit(limit)
  const rows = unwrap<VenueRow[]>(result)
  return rows.map(rowToVenue)
}

/**
 * Fetch a single venue by id.
 */
export async function getVenue(id: string): Promise<Venue | null> {
  const result = await fromAlive('venues', SELECT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  const row = unwrapMaybe<VenueRow>(result)
  return row ? rowToVenue(row) : null
}

/**
 * Fetch trending venues (client-side sort mirrors old mock logic).
 * The backend team may move this into a SQL function or materialised view.
 */
export async function listTrending(limit = 50): Promise<Venue[]> {
  const result = await fromAlive('venues', SELECT_COLUMNS)
    .gt('pulse_score', 50)
    .order('score_velocity', { ascending: false })
    .limit(limit)
  const rows = unwrap<VenueRow[]>(result)
  return rows.map(rowToVenue)
}

/**
 * Fetch venues within `radiusMi` miles of a point using the PostGIS
 * helper set up in the initial schema. Falls back to a pulse_score sort
 * if the RPC is unavailable (e.g. PostGIS disabled in local dev).
 */
export async function listNearby(
  lat: number,
  lng: number,
  radiusMi = 5,
  limit = 100,
): Promise<Venue[]> {
  // PostGIS path via an RPC the backend team can add (see runbook).
  const rpc = await supabase.rpc('venues_within_miles', { lat, lng, radius_mi: radiusMi, max_rows: limit })
  if (!rpc.error && Array.isArray(rpc.data)) {
    return (rpc.data as VenueRow[]).map(rowToVenue)
  }
  // Fallback: naive load + client filter. Fine for scaffolding.
  const all = await listVenues(limit * 4)
  return all
    .filter((v) => haversineMiles(lat, lng, v.location.lat, v.location.lng) <= radiusMi)
    .slice(0, limit)
}

/**
 * Search venues by name/category. Uses a trigram ilike — for production
 * swap in a text-search index.
 */
export async function searchVenues(query: string, limit = 25): Promise<Venue[]> {
  const q = query.trim()
  if (!q) return []
  const result = await fromAlive('venues', SELECT_COLUMNS)
    .or(`name.ilike.%${q}%,category.ilike.%${q}%,city.ilike.%${q}%`)
    .order('pulse_score', { ascending: false })
    .limit(limit)
  const rows = unwrap<VenueRow[]>(result)
  return rows.map(rowToVenue)
}

// ── Local helpers ────────────────────────────────────────────────────────

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
