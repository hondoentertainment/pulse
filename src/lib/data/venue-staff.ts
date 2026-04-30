/**
 * Venue-staff data access.
 *
 * RLS enforces that only venue owner-admins can insert/update/delete
 * staff rows; reads are allowed for any authenticated member of the
 * venue. The client-side helpers are thin wrappers around Supabase
 * with typed return values.
 */

import { supabase } from '@/lib/supabase'

export type VenueStaffRole = 'admin' | 'door' | 'manager'

export interface VenueStaffMembership {
  venueId: string
  userId: string
  role: VenueStaffRole
  addedBy: string | null
  addedAt: string
}

interface VenueStaffRow {
  venue_id: string
  user_id: string
  role: VenueStaffRole
  added_by: string | null
  added_at: string
}

function toMembership(row: VenueStaffRow): VenueStaffMembership {
  return {
    venueId: row.venue_id,
    userId: row.user_id,
    role: row.role,
    addedBy: row.added_by,
    addedAt: row.added_at,
  }
}

export async function listMyVenueStaffRoles(userId: string): Promise<VenueStaffMembership[]> {
  if (!userId) return []
  const { data, error } = await supabase
    .from('venue_staff')
    .select('venue_id, user_id, role, added_by, added_at')
    .eq('user_id', userId)
  if (error || !data) return []
  return (data as VenueStaffRow[]).map(toMembership)
}

export async function listVenueStaff(venueId: string): Promise<VenueStaffMembership[]> {
  if (!venueId) return []
  const { data, error } = await supabase
    .from('venue_staff')
    .select('venue_id, user_id, role, added_by, added_at')
    .eq('venue_id', venueId)
  if (error || !data) return []
  return (data as VenueStaffRow[]).map(toMembership)
}

export interface AddStaffInput {
  venueId: string
  userId: string
  role: VenueStaffRole
  addedBy: string
}

export async function addStaffMember(input: AddStaffInput): Promise<VenueStaffMembership | null> {
  const { data, error } = await supabase
    .from('venue_staff')
    .insert({
      venue_id: input.venueId,
      user_id: input.userId,
      role: input.role,
      added_by: input.addedBy,
    })
    .select('venue_id, user_id, role, added_by, added_at')
    .single()
  if (error || !data) return null
  return toMembership(data as VenueStaffRow)
}

export async function removeStaffMember(venueId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('venue_staff')
    .delete()
    .eq('venue_id', venueId)
    .eq('user_id', userId)
  return !error
}

export async function updateStaffRole(
  venueId: string,
  userId: string,
  role: VenueStaffRole
): Promise<VenueStaffMembership | null> {
  const { data, error } = await supabase
    .from('venue_staff')
    .update({ role })
    .eq('venue_id', venueId)
    .eq('user_id', userId)
    .select('venue_id, user_id, role, added_by, added_at')
    .single()
  if (error || !data) return null
  return toMembership(data as VenueStaffRow)
}
