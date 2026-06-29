/**
 * GET /api/pulses/get
 *
 * Authenticated pulse detail by id (RLS-scoped).
 * Query: `id` (required) — pulse id.
 *
 * Response: `{ data: { pulse } }` — pulse matches the app `Pulse` shape.
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
  const idRaw = Array.isArray(q.id) ? q.id[0] : q.id
  const pulseId = typeof idRaw === 'string' ? asString(idRaw, 1, 128) : null
  if (!pulseId) {
    fail(res, 400, 'invalid_input', 'Query param `id` is required (max 128 chars)')
    return
  }

  const client = createUserClient(auth.context.token)
  const { data, error } = await client
    .from('pulses')
    .select(PULSE_SELECT_COLUMNS)
    .eq('id', pulseId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    fail(res, 500, 'pulse_get_failed', error.message)
    return
  }

  if (!data) {
    fail(res, 404, 'pulse_not_found', 'Pulse not found')
    return
  }

  ok(res, { pulse: rowToAppPulse(data as unknown as PulseRow) })
}
