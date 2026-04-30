/**
 * GET /api/weather/current?lat=<float>&lng=<float>
 *
 * Returns current weather for a coordinate bucket.  No API key required:
 * we proxy Open-Meteo.  Responses are cached in-process per
 * (rounded lat, rounded lng, 15-min bucket).
 *
 * Env (optional):
 *   - OPEN_METEO_BASE_URL — override upstream base url (testing).
 */

import type { WeatherCondition, WeatherPayload } from '../../src/lib/types'

export type { WeatherCondition, WeatherPayload }

type RequestLike = {
  method?: string
  query?: Record<string, string | string[] | undefined>
  url?: string
  headers?: Record<string, string | string[] | undefined>
}

type ResponseLike = {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  end: () => void
}

interface CachedEntry {
  bucketKey: string
  payload: WeatherPayload
  storedAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __weatherCache: Map<string, CachedEntry> | undefined
  // eslint-disable-next-line no-var
  var __weatherRateLimiter: Map<string, number[]> | undefined
}

const CACHE_MS = 15 * 60 * 1000
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 120

const getCache = (): Map<string, CachedEntry> => {
  if (!globalThis.__weatherCache) globalThis.__weatherCache = new Map()
  return globalThis.__weatherCache
}

const getRateLimiter = (): Map<string, number[]> => {
  if (!globalThis.__weatherRateLimiter) globalThis.__weatherRateLimiter = new Map()
  return globalThis.__weatherRateLimiter
}

const setCors = (res: ResponseLike) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const extractQuery = (req: RequestLike, key: string): string | null => {
  const fromQuery = req.query?.[key]
  if (typeof fromQuery === 'string') return fromQuery
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string') return fromQuery[0]
  if (req.url) {
    const m = req.url.match(new RegExp(`[?&]${key}=([^&]+)`))
    if (m) return decodeURIComponent(m[1])
  }
  return null
}

const extractIp = (req: RequestLike): string => {
  const fwd = req.headers?.['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0].trim()
  if (Array.isArray(fwd) && fwd.length) return String(fwd[0]).split(',')[0].trim()
  return 'unknown'
}

const rateLimit = (ip: string): boolean => {
  const limiter = getRateLimiter()
  const now = Date.now()
  const bucket = limiter.get(ip) ?? []
  const fresh = bucket.filter((t) => now - t < RATE_WINDOW_MS)
  if (fresh.length >= RATE_MAX) {
    limiter.set(ip, fresh)
    return false
  }
  fresh.push(now)
  limiter.set(ip, fresh)
  return true
}

/**
 * Map Open-Meteo WMO weathercode to our simplified condition.
 * Reference: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */
export function mapWeatherCode(code: number): WeatherCondition {
  if (code === 0) return 'clear'
  if ([1, 2, 3].includes(code)) return 'cloudy'
  if ([45, 48].includes(code)) return 'fog'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if ([95, 96, 99].includes(code)) return 'storm'
  return 'unknown'
}

const bucketKey = (lat: number, lng: number): string => {
  const rLat = Math.round(lat * 100) / 100
  const rLng = Math.round(lng * 100) / 100
  const bucket = Math.floor(Date.now() / CACHE_MS)
  return `${rLat},${rLng},${bucket}`
}

async function fetchUpstream(lat: number, lng: number): Promise<WeatherPayload> {
  const base = process.env.OPEN_METEO_BASE_URL ?? 'https://api.open-meteo.com/v1/forecast'
  const url = `${base}?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,visibility&wind_speed_unit=kmh`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`open-meteo ${res.status}`)
  const body = (await res.json()) as {
    current?: {
      time?: string
      temperature_2m?: number
      precipitation?: number
      weather_code?: number
      wind_speed_10m?: number
      visibility?: number
    }
  }
  const cur = body.current ?? {}
  const tempC = typeof cur.temperature_2m === 'number' ? cur.temperature_2m : 15
  const precip = typeof cur.precipitation === 'number' ? cur.precipitation : 0
  const windKph = typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : 0
  const visibilityKm =
    typeof cur.visibility === 'number' ? Math.round(cur.visibility / 100) / 10 : 10
  return {
    condition: mapWeatherCode(cur.weather_code ?? -1),
    tempC,
    // Upstream gives mm of precipitation in the current hour. Convert to a
    // rough "probability" heuristic: clamp to 0-100 with 5mm ~= 100%.
    precipitationPct: Math.max(0, Math.min(100, Math.round((precip / 5) * 100))),
    windKph,
    visibilityKm,
    observedAt: cur.time ?? new Date().toISOString(),
  }
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!rateLimit(extractIp(req))) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  const latStr = extractQuery(req, 'lat')
  const lngStr = extractQuery(req, 'lng')
  const lat = latStr !== null ? Number.parseFloat(latStr) : NaN
  const lng = lngStr !== null ? Number.parseFloat(lngStr) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Invalid lat/lng' })
    return
  }

  const key = bucketKey(lat, lng)
  const cache = getCache()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.storedAt < CACHE_MS) {
    res.status(200).json({ data: hit.payload })
    return
  }

  try {
    const payload = await fetchUpstream(lat, lng)
    cache.set(key, { bucketKey: key, payload, storedAt: Date.now() })
    res.status(200).json({ data: payload })
  } catch (err) {
    res.status(502).json({
      error: 'weather_upstream_failed',
      detail: err instanceof Error ? err.message : 'unknown',
    })
  }
}
