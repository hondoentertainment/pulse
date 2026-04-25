/**
 * Pulse queries + write wrappers backed by Supabase.
 *
 * Runs alongside the current mock/Spark-KV paths. Write helpers route
 * through `requireUserId` and `unwrap` so RLS failures surface as
 * AuthRequiredError / RlsDeniedError with actionable messages.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { fromAlive, unwrap, unwrapMaybe } from '@/lib/auth/rls-helpers'
import type { EnergyRating, Pulse } from '@/lib/types'
import { PULSE_DECAY_MINUTES } from '@/lib/types'

// ── Row <-> Domain mapping ───────────────────────────────────────────────

interface PulseRow {
  id: string
  user_id: string
  venue_id: string
  crew_id: string | null
  photos: string[] | null
  video_url: string | null
  energy_rating: EnergyRating
  caption: string | null
  hashtags: string[] | null
  views: number | null
  is_pioneer: boolean | null
  credibility_weight: number | null
  reactions: Pulse['reactions'] | null
  created_at: string
  expires_at: string
  deleted_at: string | null
}

function rowToPulse(row: PulseRow): Pulse {
  return {
    id: row.id,
    userId: row.user_id,
    venueId: row.venue_id,
    crewId: row.crew_id ?? undefined,
    photos: row.photos ?? [],
    video: row.video_url ?? undefined,
    energyRating: row.energy_rating,
    caption: row.caption ?? undefined,
    hashtags: row.hashtags ?? [],
    views: row.views ?? 0,
    isPioneer: row.is_pioneer ?? false,
    credibilityWeight: row.credibility_weight ?? 1.0,
    reactions: row.reactions ?? { fire: [], eyes: [], skull: [], lightning: [] },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPending: false,
    uploadError: false,
  }
}

const SELECT_COLUMNS = `
  id, user_id, venue_id, crew_id, photos, video_url,
  energy_rating, caption, hashtags, views, is_pioneer,
  credibility_weight, reactions, created_at, expires_at, deleted_at
`.trim()

// ── Read queries ─────────────────────────────────────────────────────────

export async function listRecentPulsesAtVenue(
  venueId: string,
  limit = 50,
): Promise<Pulse[]> {
  const result = await fromAlive('pulses', SELECT_COLUMNS)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = unwrap<PulseRow[]>(result)
  return rows.map(rowToPulse)
}

export async function listPulsesByUser(
  userId: string,
  limit = 100,
): Promise<Pulse[]> {
  const result = await fromAlive('pulses', SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = unwrap<PulseRow[]>(result)
  return rows.map(rowToPulse)
}

export async function getPulse(id: string): Promise<Pulse | null> {
  const result = await fromAlive('pulses', SELECT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  const row = unwrapMaybe<PulseRow>(result)
  return row ? rowToPulse(row) : null
}

/**
 * Live pulses (not expired, not deleted). Used by venue score recompute
 * and trending surfaces.
 */
export async function listLivePulses(limit = 500): Promise<Pulse[]> {
  const now = new Date().toISOString()
  const result = await fromAlive('pulses', SELECT_COLUMNS)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = unwrap<PulseRow[]>(result)
  return rows.map(rowToPulse)
}

// ── Writes ───────────────────────────────────────────────────────────────

export interface CreatePulseInput {
  venueId: string
  energyRating: EnergyRating
  caption?: string
  photos?: string[]
  video?: string
  hashtags?: string[]
  crewId?: string
  credibilityWeight?: number
  isPioneer?: boolean
}

export async function createPulse(input: CreatePulseInput): Promise<Pulse> {
  const userId = await requireUserId({ action: 'post a pulse' })
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + PULSE_DECAY_MINUTES * 60 * 1000)

  const result = await supabase
    .from('pulses')
    .insert({
      user_id: userId,
      venue_id: input.venueId,
      crew_id: input.crewId ?? null,
      photos: input.photos ?? [],
      video_url: input.video ?? null,
      energy_rating: input.energyRating,
      caption: input.caption ?? null,
      hashtags: input.hashtags ?? [],
      views: 0,
      is_pioneer: input.isPioneer ?? false,
      credibility_weight: input.credibilityWeight ?? 1.0,
      reactions: { fire: [], eyes: [], skull: [], lightning: [] },
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select(SELECT_COLUMNS)
    .single()

  const row = unwrap<PulseRow>(result)
  return rowToPulse(row)
}

/**
 * Soft-delete a pulse. RLS ensures only the author (or admin) succeeds.
 */
export async function softDeletePulse(pulseId: string): Promise<void> {
  const userId = await requireUserId({ action: 'delete this pulse' })
  const result = await supabase
    .from('pulses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', pulseId)
    .eq('user_id', userId)
  if (result.error) {
    throw Object.assign(new Error(result.error.message), { cause: result.error })
  }
}
