/**
 * Client-side data accessors for creator-economy entities.
 *
 * These talk to Supabase directly where RLS allows (creators can self-read
 * their own rows) and to the Edge Functions otherwise.
 */
import { supabase } from '@/lib/supabase'

export interface CreatorProfile {
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

export interface ReferralCode {
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

export interface ReferralAttribution {
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

export interface CreatorPayout {
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

export async function getCreatorProfile(
  userId: string
): Promise<CreatorProfile | null> {
  const { data, error } = await supabase
    .from('creator_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as CreatorProfile) ?? null
}

export async function listMyReferralCodes(
  userId: string
): Promise<ReferralCode[]> {
  const { data, error } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('creator_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ReferralCode[]
}

export async function listMyAttributions(
  userId: string
): Promise<ReferralAttribution[]> {
  // Creators can read attributions for codes they own thanks to RLS policy
  // "referral_attributions creator read".
  const codes = await listMyReferralCodes(userId)
  if (codes.length === 0) return []
  const { data, error } = await supabase
    .from('referral_attributions')
    .select('*')
    .in('code', codes.map((c) => c.code))
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ReferralAttribution[]
}

export async function listMyPayouts(
  userId: string
): Promise<CreatorPayout[]> {
  const { data, error } = await supabase
    .from('creator_payouts')
    .select('*')
    .eq('creator_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CreatorPayout[]
}
