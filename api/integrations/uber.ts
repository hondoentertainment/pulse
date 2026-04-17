/**
 * Uber ride-estimate proxy.
 *
 * POST /api/integrations/uber
 *   body: { pickup: {lat, lng}, dropoff: {lat, lng}, seatCount?: number }
 *
 * Returns price + time estimates using the Uber server token. The server
 * token stays in env; the browser only ever sees the typed JSON response.
 *
 * Secrets used:
 *   UBER_SERVER_TOKEN
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
import { asLatLng, asNumber, isPlainObject } from '../_lib/validate'
import { clientKey, rateLimit } from '../_lib/rate-limit'

interface UberEstimateRequest {
  pickup: { lat: number; lng: number }
  dropoff: { lat: number; lng: number }
  seatCount?: number
}

function parseBody(raw: unknown): UberEstimateRequest | null {
  if (!isPlainObject(raw)) return null
  const pickup = asLatLng(raw.pickup)
  const dropoff = asLatLng(raw.dropoff)
  if (!pickup || !dropoff) return null
  const seatCount = raw.seatCount !== undefined
    ? asNumber(raw.seatCount, { min: 1, max: 6 }) ?? undefined
    : undefined
  return { pickup, dropoff, seatCount }
}

async function fetchEstimates(body: UberEstimateRequest): Promise<{
  priceEstimates: unknown
  timeEstimates: unknown
}> {
  const token = process.env.UBER_SERVER_TOKEN
  if (!token) throw new Error('Uber server token not configured')

  const priceUrl = new URL('https://api.uber.com/v1.2/estimates/price')
  priceUrl.searchParams.set('start_latitude', String(body.pickup.lat))
  priceUrl.searchParams.set('start_longitude', String(body.pickup.lng))
  priceUrl.searchParams.set('end_latitude', String(body.dropoff.lat))
  priceUrl.searchParams.set('end_longitude', String(body.dropoff.lng))
  if (body.seatCount !== undefined) {
    priceUrl.searchParams.set('seat_count', String(body.seatCount))
  }

  const timeUrl = new URL('https://api.uber.com/v1.2/estimates/time')
  timeUrl.searchParams.set('start_latitude', String(body.pickup.lat))
  timeUrl.searchParams.set('start_longitude', String(body.pickup.lng))

  const headers = {
    Authorization: `Token ${token}`,
    'Accept-Language': 'en_US',
    'Content-Type': 'application/json',
  }

  const [priceRes, timeRes] = await Promise.all([
    fetch(priceUrl.toString(), { headers }),
    fetch(timeUrl.toString(), { headers }),
  ])

  if (!priceRes.ok) throw new Error(`Uber price failed (${priceRes.status})`)
  if (!timeRes.ok) throw new Error(`Uber time failed (${timeRes.status})`)

  const price = (await priceRes.json()) as { prices?: unknown }
  const time = (await timeRes.json()) as { times?: unknown }
  return { priceEstimates: price.prices ?? [], timeEstimates: time.times ?? [] }
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  setCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS'])

  const rl = rateLimit(clientKey(req, 'uber'), 20, 60_000)
  if (!rl.allowed) return tooManyRequests(res, 'Too many Uber requests', rl.retryAfterSeconds)

  let body: UberEstimateRequest | null
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
      'Uber estimate failed',
      err instanceof Error ? err.message : undefined
    )
  }
}
