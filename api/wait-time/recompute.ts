/**
 * GET /api/wait-time/recompute
 *
 * Triggered by Vercel cron (every 10 minutes — see vercel.json).  Iterates
 * over venues with recent activity (pulses in last 60 min) and recomputes
 * wait-time snapshots.
 *
 * Auth: expects CRON_SECRET via ?secret= or Authorization header when
 * running in production.  In local/test (no secret set), auth is bypassed.
 */

import {
  estimateWaitTime,
  toWaitTimeRow,
  type WaitTimeInputRow,
  type WaitTimePulseRow,
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
}

const getCache = (): Map<string, VenueWaitTime> => {
  if (!globalThis.__waitTimeCache) globalThis.__waitTimeCache = new Map()
  return globalThis.__waitTimeCache
}

const setCors = (res: ResponseLike) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
}

const checkAuth = (req: RequestLike): boolean => {
  const required = process.env.CRON_SECRET
  if (!required) return true // local/test mode
  const auth = req.headers?.['authorization']
  const authStr = Array.isArray(auth) ? auth[0] : auth
  if (typeof authStr === 'string' && authStr === `Bearer ${required}`) return true
  const secret = req.query?.secret
  const secretStr = Array.isArray(secret) ? secret[0] : secret
  return secretStr === required
}

interface ActiveVenueRow {
  venue_id: string
  pulses: WaitTimePulseRow[]
  checkIns: WaitTimeInputRow[]
}

async function fetchActiveVenues(): Promise<ActiveVenueRow[]> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return []

  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  }

  const pulsesRes = await fetch(
    `${supabaseUrl}/rest/v1/pulses?created_at=gte.${sinceIso}&select=venue_id,created_at,energy_rating`,
    { headers },
  )
  if (!pulsesRes.ok) return []
  const pulses = (await pulsesRes.json()) as Array<{
    venue_id: string
    created_at: string
    energy_rating?: WaitTimePulseRow['energyRating']
  }>

  const byVenue = new Map<string, ActiveVenueRow>()
  for (const p of pulses) {
    if (!byVenue.has(p.venue_id)) {
      byVenue.set(p.venue_id, { venue_id: p.venue_id, pulses: [], checkIns: [] })
    }
    byVenue.get(p.venue_id)!.pulses.push({
      createdAt: p.created_at,
      energyRating: p.energy_rating,
    })
  }

  // Also pull presence check-ins for those venues (best-effort, individually).
  await Promise.all(
    Array.from(byVenue.values()).map(async (row) => {
      try {
        const r = await fetch(
          `${supabaseUrl}/rest/v1/presence?venue_id=eq.${row.venue_id}&last_seen_at=gte.${sinceIso}&select=last_seen_at`,
          { headers },
        )
        if (r.ok) {
          const data = (await r.json()) as Array<{ last_seen_at: string }>
          row.checkIns = data.map((d) => ({ createdAt: d.last_seen_at }))
        }
      } catch {
        // Ignore per-venue fetch errors; the pulse sample is enough.
      }
    }),
  )

  return Array.from(byVenue.values())
}

async function persist(row: VenueWaitTime): Promise<void> {
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
    // fall-through — cache still serves
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
  if (!checkAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const active = await fetchActiveVenues()
    let updated = 0
    for (const v of active) {
      const result = estimateWaitTime({
        checkIns: v.checkIns,
        pulses: v.pulses,
      })
      const row = toWaitTimeRow(v.venue_id, result)
      await persist(row)
      updated++
    }
    res.status(200).json({ ok: true, updated })
  } catch (err) {
    res.status(500).json({
      error: 'wait_time_recompute_failed',
      detail: err instanceof Error ? err.message : 'unknown',
    })
  }
}
