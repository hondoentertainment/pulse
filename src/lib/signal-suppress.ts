import type { Venue } from './types'

/** Venues with admin signal suppression are excluded from Tonight, map intel, and recommendations. */
export function isVenueSignalSuppressed(venue: Venue): boolean {
  return venue.signalSuppressed === true
}

export function filterNonSuppressedVenues(venues: Venue[]): Venue[] {
  return venues.filter((venue) => !isVenueSignalSuppressed(venue))
}

export function applySignalSuppressionToVenue(
  venue: Venue,
  suppressed: boolean,
  reason?: string | null,
): Venue {
  return {
    ...venue,
    signalSuppressed: suppressed,
    signalSuppressedReason: suppressed ? (reason ?? venue.signalSuppressedReason) : null,
    signalSuppressedAt: suppressed ? new Date().toISOString() : null,
  }
}
