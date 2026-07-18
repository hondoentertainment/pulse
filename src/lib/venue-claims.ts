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

function upsertLocal(userId: string, claim: VenueClaim): VenueClaim {
  const next = [...readClaims(userId).filter((c) => c.venueId !== claim.venueId), claim]
  writeClaims(userId, next)
  return claim
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

/**
 * Sync claims from the server into the local cache.
 * Falls back silently when offline or unauthenticated.
 */
export async function syncVenueClaimsFromServer(
  userId: string,
  accessToken: string,
): Promise<VenueClaim[]> {
  try {
    const res = await fetch('/api/venues/claim', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return readClaims(userId)
    const json = (await res.json()) as { data?: { claims?: VenueClaim[] } }
    const claims = json.data?.claims ?? []
    writeClaims(userId, claims)
    return claims
  } catch {
    return readClaims(userId)
  }
}

/**
 * Create a durable claim via API when a token is available.
 * Without a token (demo/guest), keeps the local auto-verify pilot for offline QA.
 */
export async function claimVenue(
  userId: string,
  venueId: string,
  businessName: string,
  businessEmail: string,
  accessToken?: string | null,
): Promise<VenueClaim> {
  if (accessToken) {
    try {
      const res = await fetch('/api/venues/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ venueId, businessName, businessEmail }),
      })
      if (res.ok) {
        const json = (await res.json()) as { data?: { claim?: VenueClaim } }
        if (json.data?.claim) {
          return upsertLocal(userId, json.data.claim)
        }
      }
    } catch {
      /* fall through to local pilot */
    }
  }

  return claimVenueForPilot(userId, venueId, businessName, businessEmail)
}

/** Pilot claim: create + auto-verify for closed venue-ops / offline demo. */
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
  return upsertLocal(userId, verified)
}

export function clearVenueClaimsForTests(userId: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(claimsKey(userId))
}
