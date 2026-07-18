/**
 * GET /api/notifications/list
 *
 * Authenticated notification feed for the signed-in user (RLS-scoped).
 * Query: `limit` (optional, default 100, max 200).
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { createUserClient } from '../_lib/supabase-server'

type NotificationListRow = {
  id: string
  user_id: string
  type: string
  pulse_id: string | null
  venue_id: string | null
  reaction_type: string | null
  energy_threshold: number | null
  recommended_venue_id: string | null
  read: boolean | null
  created_at: string
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

  const q = req.query ?? {}
  const limitRaw = Array.isArray(q.limit) ? q.limit[0] : q.limit
  const parsed = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : 100
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 100

  const client = createUserClient(auth.context.token)
  const { data, error } = await client
    .from('notifications')
    .select(
      'id, user_id, type, pulse_id, venue_id, reaction_type, energy_threshold, recommended_venue_id, read, created_at',
    )
    .eq('user_id', auth.context.userId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<NotificationListRow[]>()

  if (error) {
    fail(res, 500, 'notifications_list_failed', error.message)
    return
  }

  const notifications = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    pulseId: row.pulse_id ?? undefined,
    venueId: row.venue_id ?? undefined,
    reactionType: row.reaction_type ?? undefined,
    energyThreshold: row.energy_threshold ?? undefined,
    recommendedVenueId: row.recommended_venue_id ?? undefined,
    read: row.read ?? false,
    createdAt: row.created_at,
  }))

  ok(res, { notifications, limit })
}
