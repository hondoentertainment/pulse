import { calculateDistance } from './pulse-engine'
import { getVenueLiveData, type VenueLiveData } from './live-intelligence'
import type { User, Venue } from './types'

export interface RightNowDecision {
  venue: Venue
  liveData: VenueLiveData
  score: number
  distanceMiles: number | null
  freshnessMinutes: number | null
  freshnessLabel: string
  sourceLabel: string
  trustLabel: string
  headline: string
  detail: string
}

export interface RightNowDecisionSections {
  surgingNow: RightNowDecision[]
  worthLeavingFor: RightNowDecision[]
  verifiedNearby: RightNowDecision[]
}

interface RankedRightNowVenue extends RightNowDecision {
  trustPoints: number
  ownerConfirmedCount: number
  guestSignalCount: number
  loyaltyBonus: number
  pulseMomentumScore: number
}

function getFreshnessMinutes(venue: Venue): number | null {
  const timestamps = [venue.lastPulseAt, venue.lastActivity].filter(Boolean)
  if (timestamps.length === 0) return null

  const latest = timestamps
    .map(value => new Date(value as string).getTime())
    .filter(value => Number.isFinite(value))
    .sort((a, b) => b - a)[0]

  if (latest === undefined) return null
  return Math.max(0, Math.round((Date.now() - latest) / 60000))
}

function getFreshnessLabel(minutes: number | null): string {
  if (minutes === null) return 'Activity timing unclear'
  if (minutes <= 10) return 'Active in the last 10 min'
  if (minutes <= 30) return 'Active in the last 30 min'
  if (minutes <= 60) return 'Saw movement within the hour'
  return 'More than an hour since last pulse'
}

function getTrustSummary(liveData: VenueLiveData): {
  ownerConfirmedCount: number
  guestSignalCount: number
  sourceLabel: string
  trustLabel: string
  trustPoints: number
} {
  const details = Object.values(liveData.confidenceDetails)
  const ownerConfirmedCount = details.filter(detail => detail.operatorVerified).length
  const guestSignalCount = details.filter(detail => detail.reportCount > 0).length
  const highConfidenceCount = details.filter(detail => detail.level === 'high').length

  let sourceLabel = 'Fresh signal'
  if (ownerConfirmedCount > 0) {
    sourceLabel = 'Venue verified'
  } else if (guestSignalCount >= 2) {
    sourceLabel = 'Guest reports'
  }

  let trustLabel = 'No strong live proof yet'
  if (ownerConfirmedCount > 0 && guestSignalCount > 0) {
    trustLabel = `${ownerConfirmedCount} owner-confirmed update${ownerConfirmedCount === 1 ? '' : 's'} and ${guestSignalCount} guest signal${guestSignalCount === 1 ? '' : 's'}`
  } else if (ownerConfirmedCount > 0) {
    trustLabel = `${ownerConfirmedCount} owner-confirmed update${ownerConfirmedCount === 1 ? '' : 's'}`
  } else if (guestSignalCount > 0) {
    trustLabel = `${guestSignalCount} guest signal${guestSignalCount === 1 ? '' : 's'} in the last 30 min`
  }

  const trustPoints = ownerConfirmedCount * 18 + guestSignalCount * 8 + highConfidenceCount * 6
  return { ownerConfirmedCount, guestSignalCount, sourceLabel, trustLabel, trustPoints }
}

function getLoyaltyBonus(user: User, venue: Venue): number {
  let bonus = 0
  if (user.favoriteVenues?.includes(venue.id)) bonus += 8
  if (user.followedVenues?.includes(venue.id)) bonus += 5
  if ((user.venueCheckInHistory?.[venue.id] ?? 0) > 0) bonus += 4
  return bonus
}

function buildHeadline(venue: Venue, liveData: VenueLiveData, trust: ReturnType<typeof getTrustSummary>, distanceMiles: number | null): string {
  if (trust.ownerConfirmedCount > 0 && distanceMiles !== null && distanceMiles <= 2) {
    return 'Verified nearby with live venue updates'
  }
  if (liveData.doorMode.entryConfidence >= 75 && venue.pulseScore >= 60) {
    return 'High energy with a strong chance of getting in smoothly'
  }
  if (venue.pulseScore >= 75) {
    return 'One of the hottest rooms in the app right now'
  }
  if (liveData.waitTime !== null && liveData.waitTime <= 10) {
    return 'Easy door reports make this a low-friction move'
  }
  return 'Strong live signals make this worth checking right now'
}

function buildDetail(venue: Venue, liveData: VenueLiveData, freshnessLabel: string): string {
  const detailParts: string[] = []

  detailParts.push(`Pulse ${venue.pulseScore}`)

  if (liveData.waitTime !== null) {
    detailParts.push(liveData.waitTime === 0 ? 'No wait reported' : `~${liveData.waitTime} min door`)
  }

  if (liveData.doorMode.guestListStatus) {
    detailParts.push(`Guest list ${liveData.doorMode.guestListStatus}`)
  }

  if (liveData.special) {
    detailParts.push(liveData.special)
  } else {
    detailParts.push(freshnessLabel)
  }

  return detailParts.slice(0, 3).join(' • ')
}

function rankVenue(venue: Venue, user: User, userLocation?: { lat: number; lng: number } | null): RankedRightNowVenue {
  const liveData = getVenueLiveData(venue.id)
  const distanceMiles = userLocation
    ? calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
    : null
  const freshnessMinutes = getFreshnessMinutes(venue)
  const freshnessLabel = getFreshnessLabel(freshnessMinutes)
  const trust = getTrustSummary(liveData)
  const loyaltyBonus = getLoyaltyBonus(user, venue)
  const pulseMomentumScore =
    venue.pulseScore * 1.1 +
    liveData.crowdLevel * 0.35 +
    (venue.scoreVelocity ?? 0) * 20 +
    (freshnessMinutes !== null ? Math.max(0, 18 - freshnessMinutes / 2) : 0)

  return {
    venue,
    liveData,
    score: 0,
    distanceMiles,
    freshnessMinutes,
    freshnessLabel,
    sourceLabel: trust.sourceLabel,
    trustLabel: trust.trustLabel,
    headline: buildHeadline(venue, liveData, trust, distanceMiles),
    detail: buildDetail(venue, liveData, freshnessLabel),
    trustPoints: trust.trustPoints,
    ownerConfirmedCount: trust.ownerConfirmedCount,
    guestSignalCount: trust.guestSignalCount,
    loyaltyBonus,
    pulseMomentumScore,
  }
}

function withScore(base: RankedRightNowVenue, score: number): RightNowDecision {
  return {
    venue: base.venue,
    liveData: base.liveData,
    score,
    distanceMiles: base.distanceMiles,
    freshnessMinutes: base.freshnessMinutes,
    freshnessLabel: base.freshnessLabel,
    sourceLabel: base.sourceLabel,
    trustLabel: base.trustLabel,
    headline: base.headline,
    detail: base.detail,
  }
}

export function getRightNowDecisionSections(
  venues: Venue[],
  user: User,
  userLocation?: { lat: number; lng: number } | null,
  limitPerSection: number = 3
): RightNowDecisionSections {
  const ranked = venues.map(venue => rankVenue(venue, user, userLocation))

  const surgingNow = ranked
    .map(item => {
      const score =
        item.pulseMomentumScore +
        item.trustPoints * 0.4 +
        item.loyaltyBonus +
        (item.distanceMiles !== null ? Math.max(0, 10 - item.distanceMiles * 1.5) : 0)

      return withScore(item, score)
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limitPerSection)

  const used = new Set(surgingNow.map(item => item.venue.id))

  const worthLeavingFor = ranked
    .filter(item => !used.has(item.venue.id))
    .map(item => {
      const waitBonus =
        item.liveData.waitTime === null
          ? 4
          : item.liveData.waitTime <= 10
            ? 24
            : item.liveData.waitTime <= 20
              ? 14
              : 0
      const frictionPenalty =
        (item.liveData.waitTime !== null && item.liveData.waitTime > 20 ? 18 : item.liveData.waitTime !== null && item.liveData.waitTime > 10 ? 8 : 0) +
        (item.liveData.doorMode.guestListStatus === 'closed' ? 18 : item.liveData.doorMode.guestListStatus === 'limited' ? 8 : 0) +
        (item.liveData.doorMode.lineStatus === 'door-risk' ? 14 : item.liveData.doorMode.lineStatus === 'slow' ? 6 : 0)
      const score =
        item.venue.pulseScore * 0.45 +
        item.liveData.doorMode.entryConfidence * 0.95 +
        item.trustPoints * 0.5 +
        item.loyaltyBonus +
        waitBonus -
        frictionPenalty -
        (item.distanceMiles !== null ? item.distanceMiles * 7 : 0)

      return withScore(item, score)
    })
    .filter(item => item.score >= 55)
    .sort((a, b) => b.score - a.score)
    .slice(0, limitPerSection)

  worthLeavingFor.forEach(item => used.add(item.venue.id))

  const verifiedNearby = ranked
    .filter(item => item.distanceMiles === null || item.distanceMiles <= 5)
    .filter(item => item.ownerConfirmedCount > 0 || item.guestSignalCount >= 2)
    .map(item => {
      const score =
        item.trustPoints * 1.2 +
        item.liveData.doorMode.entryConfidence * 0.45 +
        item.venue.pulseScore * 0.35 +
        item.loyaltyBonus +
        (item.distanceMiles !== null ? Math.max(0, 20 - item.distanceMiles * 5) : 8)

      return withScore(item, score)
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limitPerSection)

  return {
    surgingNow,
    worthLeavingFor,
    verifiedNearby,
  }
}
