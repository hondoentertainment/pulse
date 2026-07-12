/**
 * GET /api/admin/venues-completeness  (admin-only)
 *
 * Fetches a lightweight projection of `venues`, scores each row with the
 * shared completeness heuristic (`api/_lib/venue-completeness.ts` — mirrors
 * `src/lib/venue-completeness.ts`), and returns venues sorted ascending by
 * score (worst data quality first) alongside a city-wide summary.
 *
 * Auth: requires an authed Supabase JWT whose `app_metadata.role === 'admin'`
 * (same local-decode gate as `api/admin/venue-metadata.ts`).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  parseQueryInt,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth, decodeJwt } from '../_lib/auth'
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'
import {
  cityRowCompletenessSummary,
  rankVenueRowsByCompleteness,
  scoreVenueRowCompleteness,
  type VenueRow,
} from '../_lib/venue-completeness'

const SELECT_COLUMNS = [
  'id',
  'name',
  'city',
  'state',
  'neighborhood',
  'category',
  'category_key',
  'location_address',
  'location_lat',
  'location_lng',
  'hours',
  'phone',
  'website',
  'dress_code',
  'cover_charge_cents',
  'cover_charge_note',
  'accessibility_features',
  'price_range',
  'integrations',
  'deleted_at',
].join(', ')

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

interface VenueCompletenessRow extends VenueRow {
  city?: string | null
  state?: string | null
  deleted_at?: string | null
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
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
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

  const limit = parseQueryInt(req.query?.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
  const city = typeof req.query?.city === 'string' ? req.query.city : undefined

  try {
    const client = buildSupabaseClient(auth.context.token)
    let query = client
      .from('venues')
      .select(SELECT_COLUMNS)
      .is('deleted_at', null)
      .limit(limit)

    if (city) {
      query = query.ilike('city', city)
    }

    const { data, error } = await query

    if (error) {
      fail(res, 500, 'fetch_failed', 'Failed to fetch venues', { details: error.message })
      return
    }

    const rows = (data ?? []) as VenueCompletenessRow[]
    const summary = cityRowCompletenessSummary(rows)
    const ranked = rankVenueRowsByCompleteness(rows, true)

    const venues = ranked.map((row) => {
      const result = scoreVenueRowCompleteness(row)
      return {
        id: row.id,
        name: row.name,
        city: row.city ?? null,
        score: result.score,
        missing: result.missing,
      }
    })

    ok(res, { summary, venues }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'fetch_exception', 'Supabase query threw', { details: message })
  }
}
