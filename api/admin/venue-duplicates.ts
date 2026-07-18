/**
 * GET /api/admin/venue-duplicates  (admin-only)
 *
 * Fetches a lightweight projection of `venues` and runs
 * `findDuplicateGroups` (`src/lib/venue-dedupe.ts`) to surface likely
 * duplicate catalog entries — same normalized name, or venues within
 * ~100m of each other with similar names. Intended to back an admin
 * clean-up queue (`/admin/venues/duplicates`) alongside the completeness
 * dashboard and Places-enrich tooling.
 *
 * Query: ?city=Seattle (optional filter) ?limit=1000 (max 2000 rows fetched
 * before grouping — grouping itself is O(n^2), so keep this bounded).
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
import { findDuplicateGroups } from '../../src/lib/venue-dedupe'
import type { Venue } from '../../src/lib/types'

const SELECT_COLUMNS = [
  'id',
  'name',
  'city',
  'state',
  'location_lat',
  'location_lng',
  'location_address',
  'deleted_at',
].join(', ')

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 2000

interface VenueDuplicateRow {
  id: string
  name: string | null
  city: string | null
  state: string | null
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
  deleted_at?: string | null
}

function toVenueShape(row: VenueDuplicateRow): Venue {
  return {
    id: row.id,
    name: row.name ?? '(unnamed venue)',
    location: {
      lat: row.location_lat ?? 0,
      lng: row.location_lng ?? 0,
      address: row.location_address ?? '',
    },
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    pulseScore: 0,
  }
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
    let query = client.from('venues').select(SELECT_COLUMNS).is('deleted_at', null).limit(limit)

    if (city) {
      query = query.ilike('city', city)
    }

    const { data, error } = await query

    if (error) {
      fail(res, 500, 'fetch_failed', 'Failed to fetch venues', { details: error.message })
      return
    }

    const rows = (data ?? []) as unknown as VenueDuplicateRow[]
    const venues = rows.map(toVenueShape)
    const groups = findDuplicateGroups(venues)

    ok(
      res,
      {
        scanned: rows.length,
        groupCount: groups.length,
        groups: groups.map((g) => ({
          id: g.id,
          reasons: g.reasons,
          venues: g.venues.map((v) => ({
            id: v.id,
            name: v.name,
            city: v.city ?? null,
            lat: v.location.lat,
            lng: v.location.lng,
            address: v.location.address,
          })),
        })),
      },
      200,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'fetch_exception', 'Supabase query threw', { details: message })
  }
}
