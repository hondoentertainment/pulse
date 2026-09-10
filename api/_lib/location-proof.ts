/**
 * Soft near-venue proof used by POST /api/pulses/create.
 * GPS-denied posts stay allowed and unverified.
 */

export const CHECK_IN_RADIUS_MILES = 0.062

export type LocationProofReason = 'verified' | 'outside_radius' | 'location_unavailable'

export interface LocationProof {
  locationVerified: boolean
  distanceMi?: number
  reason: LocationProofReason
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMiles = 3958.8
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusMiles * c
}

export function evaluateLocationProof(
  userLocation: { lat: number; lng: number } | null | undefined,
  venueLocation: { lat: number; lng: number } | null | undefined,
  radiusMiles: number = CHECK_IN_RADIUS_MILES,
): LocationProof {
  if (!userLocation || !venueLocation) {
    return { locationVerified: false, reason: 'location_unavailable' }
  }
  const distanceMi = haversineMiles(
    userLocation.lat,
    userLocation.lng,
    venueLocation.lat,
    venueLocation.lng,
  )
  if (distanceMi <= radiusMiles) {
    return { locationVerified: true, distanceMi, reason: 'verified' }
  }
  return { locationVerified: false, distanceMi, reason: 'outside_radius' }
}

export function resolvePostedLocationVerified(input: {
  clientVerified?: boolean
  userLocation?: { lat: number; lng: number } | null
  venueLocation?: { lat: number; lng: number } | null
}): LocationProof {
  if (!input.userLocation) {
    return { locationVerified: false, reason: 'location_unavailable' }
  }
  const proof = evaluateLocationProof(input.userLocation, input.venueLocation)
  if (input.clientVerified === true && proof.reason !== 'verified') {
    return { ...proof, locationVerified: false }
  }
  return proof
}
