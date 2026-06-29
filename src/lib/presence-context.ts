import type { Pulse, Venue } from './types'

/**
 * Build the `userLocations` map for {@link calculatePresence} from real venue
 * activity rather than fabricated coordinates.
 *
 * Anyone who posted a pulse at this venue within `withinMins` is treated as
 * physically present and placed at the venue's coordinates with their pulse
 * timestamp as `lastUpdate`. The presence engine independently re-checks a
 * 5-minute freshness window, so passing a slightly wider window here is safe.
 */
export function buildPresenceUserLocations(
  venue: Pick<Venue, 'id' | 'location'>,
  pulses: Pulse[],
  withinMins = 5,
): Record<string, { lat: number; lng: number; lastUpdate: string }> {
  const now = Date.now()
  const locations: Record<string, { lat: number; lng: number; lastUpdate: string }> = {}

  for (const pulse of pulses) {
    if (pulse.venueId !== venue.id) continue

    const createdAt = new Date(pulse.createdAt).getTime()
    if (Number.isNaN(createdAt)) continue

    const ageMins = (now - createdAt) / 60000
    if (ageMins > withinMins) continue

    // Keep the most recent pulse timestamp per user.
    const existing = locations[pulse.userId]
    if (existing && new Date(existing.lastUpdate).getTime() >= createdAt) continue

    locations[pulse.userId] = {
      lat: venue.location.lat,
      lng: venue.location.lng,
      lastUpdate: new Date(createdAt).toISOString(),
    }
  }

  return locations
}
