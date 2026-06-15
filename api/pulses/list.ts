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

type EnergyRating = 'dead' | 'chill' | 'buzzing' | 'electric'

interface PulseRow {
  id: string
  user_id: string
  venue_id: string
  crew_id: string | null
  photos: string[] | null
  video_url: string | null
  energy_rating: EnergyRating
  caption: string | null
  hashtags: string[] | null
  views: number | null
  is_pioneer: boolean | null
  credibility_weight: number | null
  reactions: Record<string, string[]> | null
  created_at: string
  expires_at: string
  deleted_at: string | null
}

const PULSE_COLUMNS = `
  id, user_id, venue_id, crew_id, photos, video_url,
  energy_rating, caption, hashtags, views, is_pioneer,
  credibility_weight, reactions, created_at, expires_at, deleted_at
`.trim()

function toAppPulse(row: PulseRow) {
  return {
    id: row.id,
    userId: row.user_id,
    venueId: row.venue_id,
    crewId: row.crew_id ?? undefined,
    photos: row.photos ?? [],
    video: row.video_url ?? undefined,
    energyRating: row.energy_rating,
    caption: row.caption ?? undefined,
    hashtags: row.hashtags ?? [],
    views: row.views ?? 0,
    isPioneer: row.is_pioneer ?? false,
    credibilityWeight: row.credibility_weight ?? 1.0,
    reactions: row.reactions ?? { fire: [], eyes: [], skull: [], lightning: [] },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPending: false,
    uploadError: false,
  }
}

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
    .select(PULSE_COLUMNS)
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

  const rows = (Array.isArray(data) ? data : []) as PulseRow[]
  ok(res, {
    pulses: rows.map(toAppPulse),
    limit,
    offset,
    hasMore: rows.length === limit,
  })
}
