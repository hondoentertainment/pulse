/**
 * In-memory store stub for creator economy endpoints.
 *
 * In production these would be Supabase client calls (service-role) against
 * the creator_* tables from the migration.  We keep the abstraction here so
 * tests can exercise the business logic without a live DB, mirroring the
 * approach used in `api/events.ts`.  Replace the body of each function with
 * the real Supabase query when wiring up the deploy.
 */

export interface CreatorProfileRow {
  user_id: string
  handle: string
  tier: 'creator' | 'verified' | 'elite'
  verified_at: string | null
  bio: string | null
  niche: string | null
  follower_count_cache: number
  total_earnings_cents: number
  payout_account_id: string | null
  created_at: string
  updated_at: string
}

export interface ReferralCodeRow {
  code: string
  creator_user_id: string
  venue_id: string | null
  discount_cents: number | null
  valid_from: string
  valid_to: string | null
  max_uses: number | null
  uses_count: number
  is_active: boolean
  created_at: string
}

export interface ReferralAttributionRow {
  id: string
  code: string
  referred_user_id: string
  attributed_ticket_id: string | null
  attributed_reservation_id: string | null
  commission_cents: number
  status: 'pending' | 'held' | 'paid' | 'voided'
  created_at: string
  resolved_at: string | null
}

export interface CreatorPayoutRow {
  id: string
  creator_user_id: string
  period_start: string
  period_end: string
  gross_cents: number
  platform_fee_cents: number
  tax_withheld_cents: number
  net_cents: number
  stripe_transfer_id: string | null
  status: 'pending' | 'paid' | 'failed'
  created_at: string
}

export interface VerificationRequestRow {
  id: string
  user_id: string
  submitted_social_links: unknown
  submitted_content_samples: unknown
  review_status: 'pending' | 'approved' | 'rejected'
  reviewed_by_user_id: string | null
  review_note: string | null
  created_at: string
  updated_at: string
}

declare global {
  var __creatorStore:
    | {
        profiles: Map<string, CreatorProfileRow>
        codes: Map<string, ReferralCodeRow>
        attributions: Map<string, ReferralAttributionRow>
        payouts: Map<string, CreatorPayoutRow>
        verifications: Map<string, VerificationRequestRow>
      }
    | undefined
}

export function getStore() {
  if (!globalThis.__creatorStore) {
    globalThis.__creatorStore = {
      profiles: new Map(),
      codes: new Map(),
      attributions: new Map(),
      payouts: new Map(),
      verifications: new Map(),
    }
  }
  return globalThis.__creatorStore
}

export function resetStore() {
  globalThis.__creatorStore = undefined
}
