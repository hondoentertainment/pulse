/**
 * Authentication helpers for Edge Functions.
 *
 * Resolves the requesting Supabase user from the `Authorization: Bearer <jwt>`
 * header using the service-role client. Returns `null` when unauthenticated.
 */

import { getServiceSupabase } from './supabase-server'
import { getHeader, type RequestLike } from './http'

export interface AuthContext {
  userId: string
  email?: string
}

export async function authenticate(req: RequestLike): Promise<AuthContext | null> {
  const authHeader = getHeader(req, 'authorization')
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const supabase = getServiceSupabase()
  if (!supabase) return null

  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return null
    return { userId: data.user.id, email: data.user.email ?? undefined }
  } catch {
    return null
  }
}

export async function isVenueStaff(userId: string, venueId: string): Promise<boolean> {
  const supabase = getServiceSupabase()
  if (!supabase) return false
  const { data, error } = await supabase
    .from('venue_staff')
    .select('role')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .maybeSingle()
  if (error) return false
  return !!data
}
