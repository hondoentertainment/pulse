/**
 * POST /api/safety/session/ping
 *
 * Body:
 *   sessionId: string
 *   lat: number
 *   lng: number
 *   batteryPct?: number
 *   networkQuality?: string
 *
 * Rate-limited to 1 request per 5 seconds per (user, session). 429 on violation.
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
import { asNumber, asString, isPlainObject } from '../../_lib/validate'

interface PingBody {
  sessionId: string
  lat: number
  lng: number
  batteryPct?: number
  networkQuality?: string
}

function validate(
  body: unknown,
): { ok: true; value: PingBody } | { ok: false; error: string } {
  if (!isPlainObject(body)) return { ok: false, error: 'body-not-object' }
  const sessionId = asString(body.sessionId, 1, 128)
  if (!sessionId) return { ok: false, error: 'invalid-sessionId' }
  const lat = asNumber(body.lat, { min: -90, max: 90 })
  if (lat === null) return { ok: false, error: 'invalid-lat' }
  const lng = asNumber(body.lng, { min: -180, max: 180 })
  if (lng === null) return { ok: false, error: 'invalid-lng' }
  let batteryPct: number | undefined
  if (body.batteryPct !== undefined && body.batteryPct !== null) {
    const b = asNumber(body.batteryPct, { min: 0, max: 100 })
    if (b === null) return { ok: false, error: 'invalid-batteryPct' }
    batteryPct = b
  }
  let networkQuality: string | undefined
  if (body.networkQuality !== undefined && body.networkQuality !== null) {
    const n = asString(body.networkQuality, 1, 64)
    if (!n) return { ok: false, error: 'invalid-networkQuality' }
    networkQuality = n
  }
  return {
    ok: true,
    value: { sessionId, lat, lng, batteryPct, networkQuality },
  }
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

  const parsed = validate(readJsonBody(req))
  if (!parsed.ok) {
    badRequest(res, parsed.error)
    return
  }
  const body = parsed.value

  // 1 token / 5s => refill at 0.2 tokens/sec, burst of 1.
  const limit = consumeRateLimitToken(`safety:ping:${userId}:${body.sessionId}`, {
    maxTokens: 1,
    refillPerSecond: 0.2,
  })
  if (!limit.allowed) {
    res.status(429).json({ error: 'rate-limited', retryAfterMs: limit.retryAfterMs })
    return
  }

  const client = getServiceClient()
  if (!client) {
    res.status(201).json({ data: { ok: true, devFallback: true } })
    return
  }

  // Double-check session ownership before inserting a ping.
  const { data: session, error: sessionError } = await client
    .from('safety_sessions')
    .select('id, user_id, state')
    .eq('id', body.sessionId)
    .single()

  if (sessionError || !session || session.user_id !== userId) {
    res.status(404).json({ error: 'session-not-found' })
    return
  }
  if (!['armed', 'active'].includes(session.state)) {
    badRequest(res, 'session-not-pingable', { state: session.state })
    return
  }

  const nowIso = new Date().toISOString()

  const { error: pingError } = await client.from('safety_pings').insert({
    session_id: body.sessionId,
    location_lat: body.lat,
    location_lng: body.lng,
    battery_pct: body.batteryPct ?? null,
    network_quality: body.networkQuality ?? null,
  })
  if (pingError) {
    serverError(res, pingError.message)
    return
  }

  const { error: updateError } = await client
    .from('safety_sessions')
    .update({
      last_ping_at: nowIso,
      last_location_lat: body.lat,
      last_location_lng: body.lng,
      state: session.state === 'armed' ? 'active' : session.state,
      updated_at: nowIso,
    })
    .eq('id', body.sessionId)
    .eq('user_id', userId)

  if (updateError) {
    serverError(res, updateError.message)
    return
  }

  res.status(201).json({ data: { ok: true } })
}
