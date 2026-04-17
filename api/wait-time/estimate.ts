/**
 * GET /api/wait-time/estimate?venueId=<uuid>
 *
 * Returns the most recent wait-time snapshot for a venue.  If the last row
 * is older than WAIT_TIME_TTL_MS (15 min) we recompute from check-ins +
 * pulses in the last 60 minutes and persist a fresh row.
 *
 * Auth: public.  Per-IP rate limited (light — 60 req / 60s).
 */

import {
  estimateWaitTime,
  isWaitTimeFresh,
  toWaitTimeRow,
  type WaitTimePulseRow,
  type WaitTimeInputRow,
} from '../../src/lib/wait-time-estimator'
import type { VenueWaitTime } from '../../src/lib/types'

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

declare global {
  // eslint-disable-next-line no-var
  var __waitTimeCache: Map<string, VenueWaitTime> | undefined
  // eslint-disable-next-line no-var
  var __waitTimeRateLimiter: Map<string, number[]> | undefined
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60

const getCache = (): Map<string, VenueWaitTime> => {
  if (!globalThis.__waitTimeCache) globalThis.__waitTimeCache = new Map()
  return globalThis.__waitTimeCache
}

const getRateLimiter = (): Map<string, number[]> => {
  if (!globalThis.__waitTimeRateLimiter) globalThis.__waitTimeRateLimiter = new Map()
  return globalThis.__waitTimeRateLimiter
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
  const fresh = bucket.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (fresh.length >= RATE_LIMIT_MAX) {
    limiter.set(ip, fresh)
    return false
  }
  fresh.push(now)
  limiter.set(ip, fresh)
  return true
}

/**
 * Fetches raw telemetry from Supabase.  If the env isn't wired (local dev or
 * preview without SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY), we read from the
 * in-memory api pulses store (tests / ephemeral previews) and return empty
 * check-ins — the estimator gracefully degrades to pulse-only sample.
 */
async function fetchTelemetry(venueId: string): Promise<{
  checkIns: WaitTimeInputRow[]
  pulses: WaitTimePulseRow[]
}> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    const store =
      (globalThis as unknown as { __pulseApiStore?: Array<{ venueId: string; createdAt?: string; energyRating?: WaitTimePulseRow['energyRating'] }> }).__pulseApiStore ?? []
    const pulses: WaitTimePulseRow[] = store
      .filter((p) => p.venueId === venueId && typeof p.createdAt === 'string')
      .map((p) => ({
        createdAt: p.createdAt as string,
        energyRating: p.energyRating,
      }))
    return { checkIns: [], pulses }
  }

  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  const [pulsesRes, checkInsRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/pulses?venue_id=eq.${venueId}&created_at=gte.${sinceIso}&select=created_at,energy_rating`,
      { headers },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/presence?venue_id=eq.${venueId}&last_seen_at=gte.${sinceIso}&select=last_seen_at`,
      { headers },
    ),
  ])

  const pulsesRaw = pulsesRes.ok
    ? ((await pulsesRes.json()) as Array<{ created_at: string; energy_rating?: WaitTimePulseRow['energyRating'] }>)
    : []
  const checkInsRaw = checkInsRes.ok
    ? ((await checkInsRes.json()) as Array<{ last_seen_at: string }>)
    : []

  return {
    pulses: pulsesRaw.map((p) => ({
      createdAt: p.created_at,
      energyRating: p.energy_rating,
    })),
    checkIns: checkInsRaw.map((c) => ({ createdAt: c.last_seen_at })),
  }
}

async function fetchLastWaitTimeRow(venueId: string): Promise<VenueWaitTime | null> {
  const cache = getCache()
  if (cache.has(venueId)) return cache.get(venueId) ?? null

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return null

  const res = await fetch(
    `${supabaseUrl}/rest/v1/venue_wait_times?venue_id=eq.${venueId}&order=computed_at.desc&limit=1&select=*`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{
    venue_id: string
    estimated_minutes: number
    confidence: 'low' | 'med' | 'high'
    sample_size: number
    computed_at: string
  }>
  if (!rows.length) return null
  const r = rows[0]
  const shaped: VenueWaitTime = {
    venueId: r.venue_id,
    estimatedMinutes: r.estimated_minutes,
    confidence: r.confidence,
    sampleSize: r.sample_size,
    computedAt: r.computed_at,
  }
  cache.set(venueId, shaped)
  return shaped
}

async function persistWaitTimeRow(row: VenueWaitTime): Promise<void> {
  getCache().set(row.venueId, row)

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return

  try {
    await fetch(`${supabaseUrl}/rest/v1/venue_wait_times`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        venue_id: row.venueId,
        estimated_minutes: row.estimatedMinutes,
        confidence: row.confidence,
        sample_size: row.sampleSize,
        computed_at: row.computedAt,
      }),
    })
  } catch {
    // Best-effort persistence; the cache will still serve reads.
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

  const venueId = extractQuery(req, 'venueId')
  if (!venueId || !/^[a-zA-Z0-9_-]{1,64}$/.test(venueId)) {
    res.status(400).json({ error: 'Missing or invalid venueId' })
    return
  }

  try {
    const existing = await fetchLastWaitTimeRow(venueId)
    if (isWaitTimeFresh(existing)) {
      res.status(200).json({ data: existing })
      return
    }

    const telemetry = await fetchTelemetry(venueId)
    const result = estimateWaitTime({
      checkIns: telemetry.checkIns,
      pulses: telemetry.pulses,
    })
    const row = toWaitTimeRow(venueId, result)
    await persistWaitTimeRow(row)
    res.status(200).json({ data: row })
  } catch (err) {
    res.status(500).json({
      error: 'wait_time_estimate_failed',
      detail: err instanceof Error ? err.message : 'unknown',
    })
  }
}
