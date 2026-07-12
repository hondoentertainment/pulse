/**
 * POST /api/integrations/places-enrich  (admin-only)
 *
 * Body: { venue_id: string, name?: string, lat?: number, lng?: number, dry_run?: boolean, force?: boolean }
 *
 * Looks the venue up via the Google Places API (Find Place from Text, then
 * Place Details) using `GOOGLE_MAPS_SERVER_KEY`, then backfills empty
 * `venues` columns (phone, website, hours, address, place_id, enriched_at,
 * enrichment_source). Existing non-null values are preserved unless
 * `force: true` is passed.
 *
 * `dry_run: true` returns the resolved Places data without writing to the
 * database — useful for admin UI previews before committing an enrichment.
 *
 * Auth: requires an authed Supabase JWT whose `app_metadata.role === 'admin'`
 * (same local-decode gate as `api/admin/venue-metadata.ts`).
 *
 * Returns 503 when `GOOGLE_MAPS_SERVER_KEY` is not configured.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth, decodeJwt } from '../_lib/auth'
import { asNumber, asString, isPlainObject } from '../_lib/validate'
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'

const ENRICHMENT_SOURCE = 'google_places'

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

interface PlacesEnrichBody {
  venue_id: string
  name?: string
  lat?: number
  lng?: number
  dry_run?: boolean
  force?: boolean
}

interface ValidationOk {
  ok: true
  value: PlacesEnrichBody
}
interface ValidationErr {
  ok: false
  errors: string[]
}

export function validateBody(body: unknown): ValidationOk | ValidationErr {
  if (!isPlainObject(body)) return { ok: false, errors: ['body must be a JSON object'] }

  const errors: string[] = []
  const venueId = asString(body.venue_id, 1, 128)
  if (!venueId) errors.push('venue_id is required')

  const value: PlacesEnrichBody = { venue_id: venueId ?? '' }

  if (body.name !== undefined && body.name !== null) {
    const name = asString(body.name, 1, 300)
    if (!name) errors.push('name must be a non-empty string')
    else value.name = name
  }

  if (body.lat !== undefined && body.lat !== null) {
    const lat = asNumber(body.lat, { min: -90, max: 90 })
    if (lat === null) errors.push('lat must be between -90 and 90')
    else value.lat = lat
  }

  if (body.lng !== undefined && body.lng !== null) {
    const lng = asNumber(body.lng, { min: -180, max: 180 })
    if (lng === null) errors.push('lng must be between -180 and 180')
    else value.lng = lng
  }

  if (body.dry_run !== undefined) {
    if (typeof body.dry_run !== 'boolean') errors.push('dry_run must be a boolean')
    else value.dry_run = body.dry_run
  }

  if (body.force !== undefined) {
    if (typeof body.force !== 'boolean') errors.push('force must be a boolean')
    else value.force = body.force
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value }
}

interface PlaceCandidate {
  place_id: string
  name?: string
}

interface PlaceOpeningHours {
  weekday_text?: string[]
}

interface PlaceDetailsResult {
  place_id: string
  name?: string
  formatted_phone_number?: string
  international_phone_number?: string
  website?: string
  formatted_address?: string
  opening_hours?: PlaceOpeningHours
}

async function findPlaceId(
  apiKey: string,
  query: string,
  lat?: number,
  lng?: number,
): Promise<string | null> {
  const params = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'place_id,name',
    key: apiKey,
  })
  if (lat !== undefined && lng !== undefined) {
    params.set('locationbias', `point:${lat},${lng}`)
  }
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Places Find Place failed (${res.status})`)
  const payload = (await res.json()) as { status?: string; candidates?: PlaceCandidate[] }
  if (payload.status && payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    throw new Error(`Places Find Place status: ${payload.status}`)
  }
  return payload.candidates?.[0]?.place_id ?? null
}

async function fetchPlaceDetails(apiKey: string, placeId: string): Promise<PlaceDetailsResult | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'place_id,name,formatted_phone_number,international_phone_number,website,formatted_address,opening_hours',
    key: apiKey,
  })
  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Places Details failed (${res.status})`)
  const payload = (await res.json()) as { status?: string; result?: PlaceDetailsResult }
  if (payload.status && payload.status !== 'OK') {
    throw new Error(`Places Details status: ${payload.status}`)
  }
  return payload.result ?? null
}

/**
 * Convert `weekday_text` (Google's locale-formatted strings, Monday-first)
 * into our `{ monday: "9:00 AM - 5:00 PM", ... }` shape. Best-effort: if
 * Google returns unparseable text we still keep the raw line as-is.
 */
function parseWeekdayText(weekdayText: string[] | undefined): Record<string, string> | null {
  if (!weekdayText || weekdayText.length === 0) return null
  const hours: Record<string, string> = {}
  for (const line of weekdayText) {
    const match = /^([A-Za-z]+):\s*(.+)$/.exec(line.trim())
    if (!match) continue
    const dayName = match[1].toLowerCase()
    if (!(DAY_NAMES as readonly string[]).includes(dayName)) continue
    hours[dayName] = match[2].trim()
  }
  return Object.keys(hours).length > 0 ? hours : null
}

interface VenueRowForEnrich {
  id: string
  name: string
  location_lat?: number | null
  location_lng?: number | null
  location_address?: string | null
  phone?: string | null
  website?: string | null
  hours?: Record<string, unknown> | null
  place_id?: string | null
}

/** Exported for test injection — mirrors `buildSupabaseClient` in venue-metadata.ts. */
export function buildSupabaseClient(userJwt: string): SupabaseClient {
  const serviceKey =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY as string | undefined) ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).process?.env?.SUPABASE_SERVICE_KEY as string | undefined)
  if (serviceKey) {
    const { url } = getSupabaseConfig()
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return createUserClient(userJwt)
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const claims = decodeJwt(auth.context.token) as
    | (Record<string, unknown> & { app_metadata?: { role?: string }; role?: string })
    | null
  const role =
    (claims?.app_metadata && typeof claims.app_metadata.role === 'string'
      ? claims.app_metadata.role
      : undefined) ?? (typeof claims?.role === 'string' ? claims.role : undefined)
  if (role !== 'admin') {
    fail(res, 403, 'forbidden', 'Admin role required')
    return
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!apiKey) {
    fail(res, 503, 'not_configured', 'GOOGLE_MAPS_SERVER_KEY is not configured on the server')
    return
  }

  const validated = validateBody(req.body)
  if (!validated.ok) {
    fail(res, 400, 'invalid_input', validated.errors.join('; '))
    return
  }

  const { venue_id, name, lat, lng, dry_run, force } = validated.value

  try {
    const client = buildSupabaseClient(auth.context.token)
    const { data: venue, error: fetchError } = await client
      .from('venues')
      .select('id, name, location_lat, location_lng, location_address, phone, website, hours, place_id')
      .eq('id', venue_id)
      .maybeSingle()

    if (fetchError) {
      fail(res, 500, 'fetch_failed', 'Failed to load venue', { details: fetchError.message })
      return
    }
    if (!venue) {
      fail(res, 404, 'not_found', 'Venue not found')
      return
    }

    const row = venue as VenueRowForEnrich
    const searchName = name ?? row.name
    const searchLat = lat ?? row.location_lat ?? undefined
    const searchLng = lng ?? row.location_lng ?? undefined
    const searchQuery = row.location_address ? `${searchName} ${row.location_address}` : searchName

    const placeId = row.place_id ?? (await findPlaceId(apiKey, searchQuery, searchLat, searchLng))
    if (!placeId) {
      fail(res, 404, 'place_not_found', 'No matching Google Place found for this venue')
      return
    }

    const details = await fetchPlaceDetails(apiKey, placeId)
    if (!details) {
      fail(res, 404, 'place_details_not_found', 'Google Place details lookup returned no result')
      return
    }

    const resolvedHours = parseWeekdayText(details.opening_hours?.weekday_text)
    const resolvedPhone = details.formatted_phone_number ?? details.international_phone_number ?? null

    const updateRow: Record<string, unknown> = {}
    if (force || !row.phone) updateRow.phone = resolvedPhone ?? row.phone ?? null
    if (force || !row.website) updateRow.website = details.website ?? row.website ?? null
    if (force || !hasHours(row.hours)) updateRow.hours = resolvedHours ?? row.hours ?? null
    if (force || !row.location_address) {
      updateRow.location_address = details.formatted_address ?? row.location_address ?? null
    }
    if (force || !row.place_id) updateRow.place_id = placeId
    updateRow.enriched_at = new Date().toISOString()
    updateRow.enrichment_source = ENRICHMENT_SOURCE

    const preview = {
      venue_id,
      place_id: placeId,
      resolved: {
        phone: resolvedPhone,
        website: details.website ?? null,
        hours: resolvedHours,
        address: details.formatted_address ?? null,
      },
      changes: updateRow,
    }

    if (dry_run) {
      ok(res, preview, 200)
      return
    }

    const { data: updated, error: updateError } = await client
      .from('venues')
      .update(updateRow)
      .eq('id', venue_id)
      .select(
        'id, name, phone, website, hours, location_address, place_id, enriched_at, enrichment_source',
      )
      .single()

    if (updateError) {
      fail(res, 500, 'persist_failed', 'Failed to persist enrichment', {
        details: updateError.message,
      })
      return
    }

    ok(res, updated, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 502, 'places_api_error', 'Google Places lookup failed', { details: message })
  }
}

function hasHours(hours: Record<string, unknown> | null | undefined): boolean {
  if (!hours) return false
  return Object.values(hours).some((v) => typeof v === 'string' && v.trim().length > 0)
}
