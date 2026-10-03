/**
 * Server-side venue claims. RLS: claimant reads/writes own pending rows;
 * admins read/write all. Inbox access uses verified rows here and/or
 * `venue_staff` — not the local `venue-claims` KV.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import type { ClaimStatus, VenueClaim } from '@/lib/venue-owner'
import { isValidWorkEmail, workEmailMatchesVenue } from '@/lib/claim-email-domain'

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
  work_email?: string | null
  work_email_confirmed_at?: string | null
}

export function rowToVenueClaim(row: VenueClaimRow): VenueClaim {
  return {
    id: row.id,
    venueId: row.venue_id,
    claimantUserId: row.user_id,
    businessName: (row.notes ?? row.evidence ?? '').trim() || 'Venue claim',
    businessEmail: row.work_email ?? '',
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
    .select('id, venue_id, user_id, status, evidence, notes, created_at, updated_at, reviewed_at, work_email, work_email_confirmed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as VenueClaimRow[]).map(rowToVenueClaim)
}

export async function listVenueClaimsForVenue(venueId: string): Promise<VenueClaim[]> {
  if (!venueId) return []
  const { data, error } = await supabase
    .from('venue_claims')
    .select('id, venue_id, user_id, status, evidence, notes, created_at, updated_at, reviewed_at, work_email, work_email_confirmed_at')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as VenueClaimRow[]).map(rowToVenueClaim)
}

export interface SubmitVenueClaimInput {
  venueId: string
  evidence: string
  notes?: string
  workEmail?: string
  venue?: { website?: string | null; ownerEmailDomain?: string | null }
}

/** Public claimed-venue ids. Empty until the claim-badge view/column is applied. */
export async function listVerifiedClaimVenueIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('venue_claim_badges')
    .select('venue_id')
  if (error || !data) return []
  return data
    .map((row) => (typeof row.venue_id === 'string' ? row.venue_id : ''))
    .filter(Boolean)
}

export function applyClaimVerifiedFlags<T extends { id: string; claimVerified?: boolean }>(
  venues: T[],
  claimedIds: Iterable<string>,
): T[] {
  const claimed = claimedIds instanceof Set ? claimedIds : new Set(claimedIds)
  if (claimed.size === 0) return venues
  return venues.map((venue) => (
    claimed.has(venue.id) ? { ...venue, claimVerified: true } : venue
  ))
}

export async function overlayClaimVerified<T extends { id: string; claimVerified?: boolean }>(
  venues: T[],
): Promise<T[]> {
  if (venues.length === 0) return venues
  try {
    return applyClaimVerifiedFlags(venues, await listVerifiedClaimVenueIds())
  } catch {
    return venues
  }
}

export async function tryVerifyVenueClaimByEmailDomain(claimId: string): Promise<VenueClaim | null> {
  const { data, error } = await supabase.rpc('try_verify_venue_claim_by_email_domain', {
    p_claim_id: claimId,
  })
  if (error || !data) return null
  return rowToVenueClaim(data as VenueClaimRow)
}

export async function submitVenueClaim(input: SubmitVenueClaimInput): Promise<VenueClaim> {
  const userId = await requireUserId({ action: 'claim this venue' })
  const evidence = input.evidence.trim()
  if (evidence.length < 8) {
    throw new Error('Add a short note about how you are connected to this venue')
  }
  const workEmail = input.workEmail?.trim().toLowerCase() ?? ''
  if (workEmail && !isValidWorkEmail(workEmail)) {
    throw new Error('Enter a valid work email')
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
        work_email: workEmail || null,
      },
      { onConflict: 'venue_id,user_id' },
    )
    .select('id, venue_id, user_id, status, evidence, notes, created_at, updated_at, reviewed_at, work_email, work_email_confirmed_at')
    .single()
  if (result.error || !result.data) {
    throw Object.assign(new Error(result.error?.message ?? 'Failed to submit claim'), {
      cause: result.error,
    })
  }
  let claim = rowToVenueClaim(result.data as VenueClaimRow)
  if (workEmail) {
    const verified = await tryVerifyVenueClaimByEmailDomain(claim.id)
    if (verified) claim = verified
  }
  if (
    claim.status === 'pending'
    && workEmail
    && input.venue
    && !workEmailMatchesVenue(workEmail, input.venue)
  ) {
    return claim
  }
  return claim
}
