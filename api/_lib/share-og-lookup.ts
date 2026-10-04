/**
 * Public catalog lookup for share OG cards.
 * Prefer admin when present; otherwise the anon key + RLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient, createAnonClient } from './supabase-server.js'
import { buildNeighborhoodShareOg, buildShareOgEnergy, type ShareOgEnergy } from './share-og.js'
import { resolveTaggedNeighborhoodPage } from '../../src/lib/neighborhood-slugs.js'
import { getSeattleLaunchVenues, localLaunchVenueIdForShareId } from '../../src/lib/seattle-launch-venues.js'
import { getPortlandLaunchVenues } from '../../src/lib/portland-launch-venues.js'
import { getSanFranciscoLaunchVenues } from '../../src/lib/san-francisco-launch-venues.js'

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

  if (!data || typeof data.name !== 'string') {
    const localId = localLaunchVenueIdForShareId(venueId) ?? venueId
    const curated = [
      ...getSeattleLaunchVenues(),
      ...getPortlandLaunchVenues(),
      ...getSanFranciscoLaunchVenues(),
    ].find((venue) => venue.id === venueId || venue.id === localId)
    if (!curated) return null
    return buildShareOgEnergy({
      venueName: curated.name,
      neighborhood: curated.neighborhood,
      city: curated.city,
      category: curated.category,
      pulseScore: 0,
      nowMs: options.nowMs,
    })
  }

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

export async function loadShareNeighborhoodOg(
  slug: string,
): Promise<ShareOgEnergy | null> {
  const page = resolveTaggedNeighborhoodPage(slug)
  if (!page) return null
  return buildNeighborhoodShareOg({ name: page.name, slug: page.slug, city: page.city })
}
