/**
 * Latest active heading name for a hop OG card.
 * Missing table or anon client stays a generic "Heading to {venue}" title.
 */

import { createAnonClient } from './supabase-server.js'
import { HEADING_WINDOW_MS } from '../../src/lib/heading-there.js'

export async function loadHopHeadingName(venueId: string): Promise<string | null> {
  if (!venueId) return null
  try {
    const client = createAnonClient()
    const { data, error } = await client
      .from('venue_headings')
      .select('display_name, created_at')
      .eq('venue_id', venueId)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error || !data?.[0]) return null
    const created = Date.parse(String(data[0].created_at ?? ''))
    if (!Number.isFinite(created) || Date.now() - created > HEADING_WINDOW_MS) return null
    const name = typeof data[0].display_name === 'string' ? data[0].display_name.trim() : ''
    return name || null
  } catch {
    return null
  }
}
