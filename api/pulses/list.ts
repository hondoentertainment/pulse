/**
 * GET /api/pulses/list
 *
 * Authenticated, RLS-scoped pulse feed with offset pagination.
 * Query: `limit` (default 50, max 200), `offset` (default 0),
 * optional `venueId` — when set, returns recent pulses for that venue only;
 * otherwise returns non-expired live pulses (same semantics as `listLivePulsesPaged`).
 *
 * Response: `{ data: { pulses, limit, offset, hasMore } }` — each pulse matches the app `Pulse` shape.
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
import { asString } from '../_lib/validate'
import {
  PULSE_SELECT_COLUMNS,
  rowToAppPulse,
  type PulseRow,
} from '../_lib/pulse-mapper'

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
  const venueRaw = Array.isArray(q.venueId) ? q.venueId[0] : q.venueId
  const venueId = typeof venueRaw === 'string' ? asString(venueRaw, 1, 128) : null

  const client = createUserClient(auth.context.token)
  const to = offset + limit - 1
  const now = new Date().toISOString()

  let query = client
    .from('pulses')
    .select(PULSE_SELECT_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, to)

  if (venueId) {
    query = query.eq('venue_id', venueId)
  } else {
    query = query.gt('expires_at', now)
  }

  const { data, error } = await query

  if (error) {
    fail(res, 500, 'pulse_list_failed', error.message)
    return
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as PulseRow[]
  ok(res, {
    pulses: rows.map(rowToAppPulse),
    limit,
    offset,
    hasMore: rows.length === limit,
  })
}
