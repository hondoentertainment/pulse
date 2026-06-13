/**
 * GET /api/venues/list
 *
 * Authenticated, RLS-scoped venue catalog with offset pagination.
 * Query: `limit` (default 50, max 200), `offset` (default 0).
 *
 * Response: `{ data: { venues, limit, offset, hasMore } }`
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  parseQueryInt,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { createUserClient } from '../_lib/supabase-server'

const VENUE_COLUMNS = `
  id, name, location_lat, location_lng, location_address,
  city, state, category, pulse_score, score_velocity,
  last_pulse_at, last_activity, pre_trending, pre_trending_label,
  seeded, verified_check_in_count, first_real_check_in_at,
  hours, phone, website, integrations, deleted_at
`.trim()

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET', 'OPTIONS'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const q = req.query ?? {}
  const limit = parseQueryInt(q.limit, 50, 1, 200)
  const offset = parseQueryInt(q.offset, 0, 0, 50_000)

  const client = createUserClient(auth.context.token)
  const to = offset + limit - 1

  const { data, error } = await client
    .from('venues')
    .select(VENUE_COLUMNS)
    .is('deleted_at', null)
    .order('pulse_score', { ascending: false })
    .range(offset, to)

  if (error) {
    fail(res, 500, 'venue_list_failed', error.message)
    return
  }

  const rows = Array.isArray(data) ? data : []
  ok(res, {
    venues: rows,
    limit,
    offset,
    hasMore: rows.length === limit,
  })
}
