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
  consumeRateLimitToken,
  getServiceClient,
  methodNotAllowed,
  readJsonBody,
  serverError,
  setCors,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../../_lib/safety-server'
import { asEnum, asString, isPlainObject } from '../../_lib/validate'

const REASONS = ['user_completed', 'cancelled'] as const
type Reason = (typeof REASONS)[number]

interface EndBody {
  sessionId: string
  reason: Reason
}

function validate(
  body: unknown,
): { ok: true; value: EndBody } | { ok: false; error: string } {
  if (!isPlainObject(body)) return { ok: false, error: 'body-not-object' }
  const sessionId = asString(body.sessionId, 1, 128)
  if (!sessionId) return { ok: false, error: 'invalid-sessionId' }
  let reason: Reason = 'user_completed'
  if (body.reason !== undefined) {
    const r = asEnum<Reason>(body.reason, REASONS)
    if (!r) return { ok: false, error: 'invalid-reason' }
    reason = r
  }
  return { ok: true, value: { sessionId, reason } }
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

  // 30 ends per minute per user — generous, just stops accidental loops.
  const limit = consumeRateLimitToken(`safety:session-end:${userId}`, {
    maxTokens: 30,
    refillPerSecond: 0.5,
  })
  if (!limit.allowed) {
    res.status(429).json({ error: 'rate-limited', retryAfterMs: limit.retryAfterMs })
    return
  }

  const parsed = validate(readJsonBody(req))
  if (!parsed.ok) {
    badRequest(res, parsed.error)
    return
  }
  const body = parsed.value
  const nextState = body.reason === 'cancelled' ? 'cancelled' : 'completed'

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
