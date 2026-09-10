/**
 * Server-side venue claims. RLS: claimant reads/writes own pending rows;
 * admins read/write all. Inbox access uses verified rows here and/or
 * `venue_staff` — not the local `venue-claims` KV.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import type { ClaimStatus, VenueClaim } from '@/lib/venue-owner'

export interface VenueClaimRow {
  id: string
  venue_id: string
  user_id: string
  status: ClaimStatus
  evidence: string | null
  notes: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
}

export function rowToVenueClaim(row: VenueClaimRow): VenueClaim {
  return {
    id: row.id,
    venueId: row.venue_id,
    claimantUserId: row.user_id,
    businessName: (row.notes ?? row.evidence ?? '').trim() || 'Venue claim',
    businessEmail: '',
    verificationMethod: 'document',
    status: row.status,
    createdAt: row.created_at,
    verifiedAt: row.status === 'verified' ? row.reviewed_at ?? undefined : undefined,
    rejectedReason: row.status === 'rejected' ? row.notes ?? undefined : undefined,
    evidence: row.evidence ?? undefined,
    notes: row.notes ?? undefined,
  }
}

export async function listMyVenueClaims(userId: string): Promise<VenueClaim[]> {
  if (!userId) return []
  const { data, error } = await supabase
    .from('venue_claims')
    .select('id, venue_id, user_id, status, evidence, notes, created_at, updated_at, reviewed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as VenueClaimRow[]).map(rowToVenueClaim)
}

export async function listVenueClaimsForVenue(venueId: string): Promise<VenueClaim[]> {
  if (!venueId) return []
  const { data, error } = await supabase
    .from('venue_claims')
    .select('id, venue_id, user_id, status, evidence, notes, created_at, updated_at, reviewed_at')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as VenueClaimRow[]).map(rowToVenueClaim)
}

export interface SubmitVenueClaimInput {
  venueId: string
  evidence: string
  notes?: string
}

export async function submitVenueClaim(input: SubmitVenueClaimInput): Promise<VenueClaim> {
  const userId = await requireUserId({ action: 'claim this venue' })
  const evidence = input.evidence.trim()
  if (evidence.length < 8) {
    throw new Error('Add a short note about how you are connected to this venue')
  }
  const result = await supabase
    .from('venue_claims')
    .upsert(
      {
        venue_id: input.venueId,
        user_id: userId,
        status: 'pending',
        evidence,
        notes: input.notes?.trim() || null,
        reviewed_at: null,
      },
      { onConflict: 'venue_id,user_id' },
    )
    .select('id, venue_id, user_id, status, evidence, notes, created_at, updated_at, reviewed_at')
    .single()
  if (result.error || !result.data) {
    throw Object.assign(new Error(result.error?.message ?? 'Failed to submit claim'), {
      cause: result.error,
    })
  }
  return rowToVenueClaim(result.data as VenueClaimRow)
}
