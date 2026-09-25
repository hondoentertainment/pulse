/**
 * One-hood density wedge. Capitol Hill is the focus hood.
 * Seed names come from the existing launch catalog — no ownership edits, no invites.
 */

import { SEATTLE_LAUNCH_VENUES } from './seattle-launch-venues'
import { normalizeNeighborhoodName } from './seattle-density'

export const FOCUS_HOOD_NAME = 'Capitol Hill'

export function focusHoodSeedVenues() {
  return SEATTLE_LAUNCH_VENUES.filter(
    (venue) => normalizeNeighborhoodName(venue.neighborhood) === FOCUS_HOOD_NAME,
  )
}

export function focusHoodDensityLabel(neighborhood: string | null | undefined): string | null {
  if (normalizeNeighborhoodName(neighborhood) !== FOCUS_HOOD_NAME) return null
  const count = focusHoodSeedVenues().length
  return count > 0 ? `Focus hood · ${count} launch rooms` : 'Focus hood'
}

export function focusHoodEmptyBody(): string {
  return 'Capitol Hill is the focus hood. Post a live review at a real room — we never invent a crowd.'
}
