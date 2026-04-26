/**
 * Lyft ride-estimate proxy.
 *
 * POST /api/integrations/lyft
 *   body: { pickup: {lat, lng}, dropoff: {lat, lng} }
 *
 * Uses the Lyft OAuth 2.0 client-credentials flow to mint a public
 * token server-side, then calls /v1/cost and /v1/eta.
 *
 * Secrets used:
 *   LYFT_CLIENT_ID
 *   LYFT_CLIENT_SECRET
 */

import {
  badRequest,
  handleOptions,
  methodNotAllowed,
  readJson,
  serverError,
  setCors,
  tooManyRequests,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { asLatLng, isPlainObject } from '../_lib/validate'
import { clientKey, rateLimit } from '../_lib/rate-limit'

interface LyftEstimateRequest {
  pickup: { lat: number; lng: number }
  dropoff: { lat: number; lng: number }
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function getLyftToken(): Promise<string> {
  const id = process.env.LYFT_CLIENT_ID
  const secret = process.env.LYFT_CLIENT_SECRET
  if (!id || !secret) throw new Error('Lyft credentials not configured')

  if (cachedToken && cachedToken.expiresAt > Date.now() + 15_000) {
    return cachedToken.value
  }

  const basic = Buffer.from(`${id}:${secret}`).toString('base64')
  const res = await fetch('https://api.lyft.com/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ grant_type: 'client_credentials', scope: 'public' }),
  })
  if (!res.ok) throw new Error(`Lyft token exchange failed (${res.status})`)
  const payload = (await res.json()) as {
    access_token: string
    expires_in: number
  }
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  }
  return payload.access_token
}

function parseBody(raw: unknown): LyftEstimateRequest | null {
  if (!isPlainObject(raw)) return null
  const pickup = asLatLng(raw.pickup)
  const dropoff = asLatLng(raw.dropoff)
  if (!pickup || !dropoff) return null
  return { pickup, dropoff }
}

async function fetchEstimates(body: LyftEstimateRequest): Promise<unknown> {
  const token = await getLyftToken()
  const costUrl = new URL('https://api.lyft.com/v1/cost')
  costUrl.searchParams.set('start_lat', String(body.pickup.lat))
  costUrl.searchParams.set('start_lng', String(body.pickup.lng))
  costUrl.searchParams.set('end_lat', String(body.dropoff.lat))
  costUrl.searchParams.set('end_lng', String(body.dropoff.lng))

  const etaUrl = new URL('https://api.lyft.com/v1/eta')
  etaUrl.searchParams.set('lat', String(body.pickup.lat))
  etaUrl.searchParams.set('lng', String(body.pickup.lng))

  const headers = { Authorization: `Bearer ${token}` }
  const [costRes, etaRes] = await Promise.all([
    fetch(costUrl.toString(), { headers }),
    fetch(etaUrl.toString(), { headers }),
  ])
  if (!costRes.ok) throw new Error(`Lyft cost failed (${costRes.status})`)
  if (!etaRes.ok) throw new Error(`Lyft eta failed (${etaRes.status})`)

  const cost = (await costRes.json()) as { cost_estimates?: unknown }
  const eta = (await etaRes.json()) as { eta_estimates?: unknown }
  return {
    costEstimates: cost.cost_estimates ?? [],
    etaEstimates: eta.eta_estimates ?? [],
  }
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  setCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS'])

  const rl = rateLimit(clientKey(req, 'lyft'), 20, 60_000)
  if (!rl.allowed) return tooManyRequests(res, 'Too many Lyft requests', rl.retryAfterSeconds)

  let body: LyftEstimateRequest | null
  try {
    const raw = await readJson(req)
    body = parseBody(raw)
  } catch {
    return badRequest(res, 'Invalid JSON body')
  }
  if (!body) return badRequest(res, 'pickup and dropoff {lat,lng} required')

  try {
    const estimates = await fetchEstimates(body)
    res.status(200).json({ data: estimates })
  } catch (err) {
    serverError(
      res,
      'Lyft estimate failed',
      err instanceof Error ? err.message : undefined
    )
  }
}
