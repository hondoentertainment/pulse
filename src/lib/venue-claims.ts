import type { VenueClaim } from './venue-owner'
import { createVenueClaim, verifyVenueClaim } from './venue-owner'

const claimsKey = (userId: string) => `pulse-venue-claims-${userId}`

function readClaims(userId: string): VenueClaim[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(claimsKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as VenueClaim[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeClaims(userId: string, claims: VenueClaim[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(claimsKey(userId), JSON.stringify(claims))
}

export function listVenueClaims(userId: string): VenueClaim[] {
  return readClaims(userId)
}

export function getVerifiedClaimedVenueIds(userId: string): string[] {
  return readClaims(userId)
    .filter((c) => c.status === 'verified')
    .map((c) => c.venueId)
}

export function getVerifiedClaimForVenue(
  userId: string,
  venueId: string,
): VenueClaim | null {
  return (
    readClaims(userId).find((c) => c.venueId === venueId && c.status === 'verified') ??
    null
  )
}

/** Pilot claim: create + auto-verify for closed venue-ops pilot. */
export function claimVenueForPilot(
  userId: string,
  venueId: string,
  businessName: string,
  businessEmail: string,
): VenueClaim {
  const existing = readClaims(userId)
  const prior = existing.find((c) => c.venueId === venueId)
  if (prior?.status === 'verified') return prior

  const verified = verifyVenueClaim(
    createVenueClaim(venueId, userId, businessName, businessEmail, 'email'),
  )
  const next = [...existing.filter((c) => c.venueId !== venueId), verified]
  writeClaims(userId, next)
  return verified
}

export function clearVenueClaimsForTests(userId: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(claimsKey(userId))
}
