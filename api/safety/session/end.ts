/**
 * POST /api/safety/session/end
 *
 * Body:
 *   sessionId: string
 *   reason?: 'user_completed' | 'cancelled'
 */

import {
  authenticate,
  badRequest,
  getServiceClient,
  methodNotAllowed,
  readJsonBody,
  serverError,
  setCors,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../../_lib/safety-server'

type EndBody = {
  sessionId?: string
  reason?: 'user_completed' | 'cancelled'
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'POST') {
    methodNotAllowed(res)
    return
  }

  const userId = await authenticate(req)
  if (!userId) {
    unauthorized(res)
    return
  }

  const body = readJsonBody<EndBody>(req)
  if (!body || !body.sessionId) {
    badRequest(res, 'invalid-body')
    return
  }

  const reason = body.reason ?? 'user_completed'
  const nextState = reason === 'cancelled' ? 'cancelled' : 'completed'

  const client = getServiceClient()
  if (!client) {
    res.status(200).json({ data: { ok: true, devFallback: true, state: nextState } })
    return
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await client
    .from('safety_sessions')
    .update({ state: nextState, actual_end_at: nowIso, updated_at: nowIso })
    .eq('id', body.sessionId)
    .eq('user_id', userId)
    .in('state', ['armed', 'active'])
    .select()
    .single()

  if (error) {
    serverError(res, error.message)
    return
  }

  if (!data) {
    res.status(404).json({ error: 'session-not-endable' })
    return
  }

  res.status(200).json({ data })
}
