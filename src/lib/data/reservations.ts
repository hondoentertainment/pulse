/**
 * Reservation data access.
 *
 * Owners can read their own; venue staff can read/update reservations
 * for their venue (gated by the `venue_staff` mapping table).
 */

import { supabase } from '@/lib/supabase'

export type ReservationStatus =
  | 'requested'
  | 'confirmed'
  | 'seated'
  | 'cancelled'
  | 'no_show'
  | 'completed'

export interface ReservationRow {
  id: string
  venue_id: string
  user_id: string
  party_size: number
  starts_at: string
  ends_at: string | null
  status: ReservationStatus
  deposit_cents: number
  deposit_payment_intent: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export async function listMyReservations(userId: string): Promise<ReservationRow[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, venue_id, user_id, party_size, starts_at, ends_at, status, deposit_cents, deposit_payment_intent, notes, created_at, updated_at, deleted_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ReservationRow[]
}

export async function listVenueReservations(
  venueId: string,
  opts?: { from?: string; to?: string },
): Promise<ReservationRow[]> {
  let q = supabase
    .from('reservations')
    .select('id, venue_id, user_id, party_size, starts_at, ends_at, status, deposit_cents, deposit_payment_intent, notes, created_at, updated_at, deleted_at')
    .eq('venue_id', venueId)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
  if (opts?.from) q = q.gte('starts_at', opts.from)
  if (opts?.to) q = q.lte('starts_at', opts.to)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ReservationRow[]
}
