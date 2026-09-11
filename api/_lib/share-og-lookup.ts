/**
 * Public catalog lookup for share OG cards.
 * Prefer admin when present; otherwise the anon key + RLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient, createAnonClient } from './supabase-server.js'
import { buildShareOgEnergy, type ShareOgEnergy } from './share-og.js'

export type ShareCatalogClient = Pick<SupabaseClient, 'from'>

const VENUE_OG_COLUMNS = 'name, neighborhood, city, category, pulse_score'
const PULSE_OG_COLUMNS = 'energy_rating, created_at'

export function resolveShareCatalogClient(): ShareCatalogClient {
  return createAdminClient() ?? createAnonClient()
}

export async function loadShareOgEnergy(
  venueId: string,
  options: { client?: ShareCatalogClient; nowMs?: number } = {},
): Promise<ShareOgEnergy | null> {
  const client = options.client ?? resolveShareCatalogClient()
  const { data } = await client
    .from('venues')
    .select(VENUE_OG_COLUMNS)
    .eq('id', venueId)
    .maybeSingle()
  const { data: latest } = await client
    .from('pulses')
    .select(PULSE_OG_COLUMNS)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data || typeof data.name !== 'string') return null

  return buildShareOgEnergy({
    venueName: data.name,
    neighborhood: typeof data.neighborhood === 'string' ? data.neighborhood : null,
    city: typeof data.city === 'string' ? data.city : null,
    category: typeof data.category === 'string' ? data.category : null,
    pulseScore: typeof data.pulse_score === 'number' ? data.pulse_score : null,
    latestEnergyRating: typeof latest?.energy_rating === 'string' ? latest.energy_rating : null,
    latestCreatedAt: typeof latest?.created_at === 'string' ? latest.created_at : null,
    nowMs: options.nowMs,
  })
}
