/**
 * Check-in queries + writes.
 *
 * A check-in is the authenticated, geo-verified marker that a user
 * visited a venue. Pulses are created *on top of* a check-in. We keep
 * this separate from `presence` (currently-at-venue state) so analytics
 * can reason about historical visits independently.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { fromAlive, unwrap } from '@/lib/auth/rls-helpers'

export type CheckInSource = 'geo' | 'manual' | 'crew' | 'event'

export interface CheckIn {
  id: string
  userId: string
  venueId: string
  checkedInLat: number | null
  checkedInLng: number | null
  distanceFromVenueMi: number | null
  crewId: string | null
  source: CheckInSource
  createdAt: string
}

interface CheckInRow {
  id: string
  user_id: string
  venue_id: string
  checked_in_lat: number | null
  checked_in_lng: number | null
  distance_from_venue_mi: number | null
  crew_id: string | null
  source: CheckInSource
  created_at: string
  deleted_at: string | null
}

function rowToCheckIn(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    userId: row.user_id,
    venueId: row.venue_id,
    checkedInLat: row.checked_in_lat,
    checkedInLng: row.checked_in_lng,
    distanceFromVenueMi: row.distance_from_venue_mi,
    crewId: row.crew_id,
    source: row.source,
    createdAt: row.created_at,
  }
}

const SELECT_COLUMNS = `
  id, user_id, venue_id, checked_in_lat, checked_in_lng,
  distance_from_venue_mi, crew_id, source, created_at, deleted_at
`.trim()

// ── Reads ────────────────────────────────────────────────────────────────

export async function listCheckInsAtVenue(
  venueId: string,
  limit = 100,
): Promise<CheckIn[]> {
  const result = await fromAlive('check_ins', SELECT_COLUMNS)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = unwrap<CheckInRow[]>(result)
  return rows.map(rowToCheckIn)
}

export async function listCheckInsByUser(
  userId: string,
  limit = 100,
): Promise<CheckIn[]> {
  const result = await fromAlive('check_ins', SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = unwrap<CheckInRow[]>(result)
  return rows.map(rowToCheckIn)
}

// ── Writes ───────────────────────────────────────────────────────────────

export interface CreateCheckInInput {
  venueId: string
  lat?: number
  lng?: number
  distanceFromVenueMi?: number
  crewId?: string
  source?: CheckInSource
}

export async function createCheckIn(input: CreateCheckInInput): Promise<CheckIn> {
  const userId = await requireUserId({ action: 'check in' })
  const result = await supabase
    .from('check_ins')
    .insert({
      user_id: userId,
      venue_id: input.venueId,
      checked_in_lat: input.lat ?? null,
      checked_in_lng: input.lng ?? null,
      distance_from_venue_mi: input.distanceFromVenueMi ?? null,
      crew_id: input.crewId ?? null,
      source: input.source ?? 'geo',
    })
    .select(SELECT_COLUMNS)
    .single()
  const row = unwrap<CheckInRow>(result)
  return rowToCheckIn(row)
}
