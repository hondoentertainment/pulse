/**
 * Daily spend / request tracking for vibe vision assessments.
 *
 * Mirrors concierge session caps: prefer Supabase rollup when available,
 * fall open to an in-memory bucket for local/dev.
 */

import { createUserClient } from './supabase-server'

const DEFAULT_DAILY_CENTS_CAP = 50 // $0.50 / user / UTC day
const memory = new Map<string, { costCents: number; requests: number }>()

export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function getDailyCentsCap(): number {
  const raw = process.env.VIBE_VISION_DAILY_CENTS_CAP
  const parsed = raw ? Number.parseFloat(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_CENTS_CAP
}

export interface DailySpendState {
  day: string
  spentCents: number
  requestCount: number
  capCents: number
}

function memoryKey(userId: string, day: string): string {
  return `${userId}:${day}`
}

export async function loadDailySpend(
  userId: string,
  userJwt: string,
): Promise<DailySpendState> {
  const day = utcDayKey()
  const capCents = getDailyCentsCap()

  try {
    const supa = createUserClient(userJwt)
    const { data } = await supa
      .from('vibe_assess_daily')
      .select('request_count,total_cost_cents')
      .eq('user_id', userId)
      .eq('day', day)
      .maybeSingle()

    if (data) {
      return {
        day,
        spentCents: Number(data.total_cost_cents ?? 0),
        requestCount: Number(data.request_count ?? 0),
        capCents,
      }
    }
  } catch {
    // fall through to memory
  }

  const mem = memory.get(memoryKey(userId, day))
  return {
    day,
    spentCents: mem?.costCents ?? 0,
    requestCount: mem?.requests ?? 0,
    capCents,
  }
}

export async function recordDailySpend(args: {
  userId: string
  userJwt: string
  costCents: number
  blocked?: boolean
  lowConfidence?: boolean
}): Promise<DailySpendState> {
  const day = utcDayKey()
  const capCents = getDailyCentsCap()
  const key = memoryKey(args.userId, day)
  const prev = memory.get(key) ?? { costCents: 0, requests: 0 }
  const next = {
    costCents: prev.costCents + Math.max(0, args.costCents),
    requests: prev.requests + 1,
  }
  memory.set(key, next)

  // Persist best-effort; always return the in-memory rollup for this process
  // so local/dev (and tests against placeholder Supabase) stay consistent.
  try {
    const supa = createUserClient(args.userJwt)
    const { data: existing } = await supa
      .from('vibe_assess_daily')
      .select('request_count,total_cost_cents,blocked_count,low_confidence_count')
      .eq('user_id', args.userId)
      .eq('day', day)
      .maybeSingle()

    const requestCount = Math.max(
      next.requests,
      Number(existing?.request_count ?? 0) + 1,
    )
    const totalCost = Math.max(
      next.costCents,
      Number(existing?.total_cost_cents ?? 0) + Math.max(0, args.costCents),
    )
    const blockedCount =
      Number(existing?.blocked_count ?? 0) + (args.blocked ? 1 : 0)
    const lowConfidenceCount =
      Number(existing?.low_confidence_count ?? 0) + (args.lowConfidence ? 1 : 0)

    await supa.from('vibe_assess_daily').upsert(
      {
        user_id: args.userId,
        day,
        request_count: requestCount,
        total_cost_cents: totalCost,
        blocked_count: blockedCount,
        low_confidence_count: lowConfidenceCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day' },
    )

    // Keep memory aligned with the higher of process vs DB.
    memory.set(key, { costCents: totalCost, requests: requestCount })
  } catch {
    // ignore — memory already updated
  }

  const final = memory.get(key) ?? next
  return {
    day,
    spentCents: final.costCents,
    requestCount: final.requests,
    capCents,
  }
}

export async function recordAssessEvent(args: {
  userId: string
  userJwt: string
  venueId?: string
  energyRating?: string
  confidence?: number
  safe: boolean
  blockedReason?: string | null
  costCents: number
  source: string
  storageKey?: string
}): Promise<void> {
  try {
    const supa = createUserClient(args.userJwt)
    await supa.from('vibe_assess_events').insert({
      user_id: args.userId,
      venue_id: args.venueId ?? null,
      energy_rating: args.energyRating ?? null,
      confidence: args.confidence ?? null,
      safe: args.safe,
      blocked_reason: args.blockedReason ?? null,
      cost_cents: args.costCents,
      source: args.source,
      storage_key: args.storageKey ?? null,
    })
  } catch {
    // Telemetry must never break the assess path.
  }
}

/** Test helper */
export function resetVibeAssessCostMemory(): void {
  memory.clear()
}
