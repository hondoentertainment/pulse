/**
 * Reverse-geocoding proxy.
 *
 * GET /api/integrations/geocode?lat=37.77&lng=-122.41&provider=mapbox
 *
 * Providers: `mapbox` (default) or `google`. The server keeps the
 * restricted tokens; the browser never sees them.
 *
 * Secrets used:
 *   MAPBOX_SERVER_TOKEN     (if provider=mapbox)
 *   GOOGLE_MAPS_SERVER_KEY  (if provider=google)
 */

import {
  badRequest,
  handleOptions,
  methodNotAllowed,
  serverError,
  setCors,
  tooManyRequests,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { asEnum, asNumber } from '../_lib/validate'
import { clientKey, rateLimit } from '../_lib/rate-limit'

interface ReverseGeocodeResult {
  address: string | null
  city: string | null
  region: string | null
  country: string | null
  postalCode: string | null
  provider: 'mapbox' | 'google'
  raw: unknown
}

async function reverseMapbox(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  const token = process.env.MAPBOX_SERVER_TOKEN
  if (!token) throw new Error('Mapbox server token not configured')
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${encodeURIComponent(token)}&types=address,place,region,country,postcode`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Mapbox reverse geocode failed (${res.status})`)
  const payload = (await res.json()) as {
    features?: Array<{
      place_name?: string
      place_type?: string[]
      text?: string
      context?: Array<{ id?: string; text?: string }>
    }>
  }
  const primary = payload.features?.[0]
  const byType = new Map<string, string>()
  for (const f of payload.features ?? []) {
    const t = f.place_type?.[0]
    if (t && f.text) byType.set(t, f.text)
    for (const ctx of f.context ?? []) {
      if (!ctx.id || !ctx.text) continue
      const typeKey = ctx.id.split('.')[0]
      if (!byType.has(typeKey)) byType.set(typeKey, ctx.text)
    }
  }
  return {
    address: primary?.place_name ?? null,
    city: byType.get('place') ?? null,
    region: byType.get('region') ?? null,
    country: byType.get('country') ?? null,
    postalCode: byType.get('postcode') ?? null,
    provider: 'mapbox',
    raw: payload,
  }
}

async function reverseGoogle(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!key) throw new Error('Google Maps server key not configured')
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(key)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Google reverse geocode failed (${res.status})`)
  const payload = (await res.json()) as {
    results?: Array<{
      formatted_address?: string
      address_components?: Array<{ long_name: string; types: string[] }>
    }>
  }
  const primary = payload.results?.[0]
  const comp = (type: string): string | null =>
    primary?.address_components?.find(c => c.types.includes(type))?.long_name ??
    null
  return {
    address: primary?.formatted_address ?? null,
    city: comp('locality') ?? comp('postal_town'),
    region: comp('administrative_area_level_1'),
    country: comp('country'),
    postalCode: comp('postal_code'),
    provider: 'google',
    raw: payload,
  }
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  setCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS'])

  const rl = rateLimit(clientKey(req, 'geocode'), 60, 60_000)
  if (!rl.allowed) return tooManyRequests(res, 'Too many geocode requests', rl.retryAfterSeconds)

  const query = req.query ?? {}
  const lat = asNumber(Number(query.lat), { min: -90, max: 90 })
  const lng = asNumber(Number(query.lng), { min: -180, max: 180 })
  if (lat === null || lng === null) {
    return badRequest(res, '`lat` and `lng` query parameters required')
  }
  const provider =
    asEnum(query.provider, ['mapbox', 'google'] as const) ?? 'mapbox'

  try {
    const result =
      provider === 'google'
        ? await reverseGoogle(lat, lng)
        : await reverseMapbox(lat, lng)
    res.status(200).json({ data: result })
  } catch (err) {
    serverError(
      res,
      'Reverse geocode failed',
      err instanceof Error ? err.message : undefined
    )
  }
}
