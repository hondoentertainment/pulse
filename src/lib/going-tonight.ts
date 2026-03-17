import type { User, Venue } from './types'

/**
 * "Going Tonight" RSVP & Friends Coordination Engine
 *
 * One-tap "I'm going tonight" with social coordination layer.
 * Tonight = 6 PM today to 4 AM tomorrow.
 */

// ── Types ────────────────────────────────────────────────────

export type RSVPStatus = 'going' | 'maybe' | 'cancelled'

export type ArrivalEstimate = 'Around 9' | 'Around 10' | 'Around 11' | 'Late night'

export interface VenueRSVP {
  userId: string
  venueId: string
  timestamp: string
  status: RSVPStatus
  arrivalEstimate?: ArrivalEstimate
}

export interface VenueNightPlan {
  venueId: string
  date: string
  rsvps: VenueRSVP[]
  friendsGoing: User[]
  totalGoing: number
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Check if a date falls within "tonight" window: 6 PM today to 4 AM tomorrow.
 * If current time is before 4 AM, "tonight" refers to the previous evening.
 */
export function isTonight(date: Date, now: Date = new Date()): boolean {
  const hour = now.getHours()

  let tonightStart: Date
  let tonightEnd: Date

  if (hour < 4) {
    // We're in the early morning — tonight started at 6 PM yesterday
    tonightStart = new Date(now)
    tonightStart.setDate(tonightStart.getDate() - 1)
    tonightStart.setHours(18, 0, 0, 0)

    tonightEnd = new Date(now)
    tonightEnd.setHours(4, 0, 0, 0)
  } else {
    // Normal evening — tonight is 6 PM today to 4 AM tomorrow
    tonightStart = new Date(now)
    tonightStart.setHours(18, 0, 0, 0)

    tonightEnd = new Date(now)
    tonightEnd.setDate(tonightEnd.getDate() + 1)
    tonightEnd.setHours(4, 0, 0, 0)
  }

  const ts = date.getTime()
  return ts >= tonightStart.getTime() && ts < tonightEnd.getTime()
}

/**
 * Get the "tonight" date string (YYYY-MM-DD) for the evening.
 * Before 4 AM → yesterday's date. Otherwise → today's date.
 */
export function getTonightDateString(now: Date = new Date()): string {
  const d = new Date(now)
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1)
  }
  return d.toISOString().split('T')[0]
}

// ── Core Functions ───────────────────────────────────────────

/**
 * Create or update an RSVP for a user at a venue.
 */
export function createRSVP(
  userId: string,
  venueId: string,
  status: RSVPStatus,
  arrivalEstimate?: ArrivalEstimate
): VenueRSVP {
  return {
    userId,
    venueId,
    timestamp: new Date().toISOString(),
    status,
    arrivalEstimate,
  }
}

/**
 * Cancel a user's RSVP at a venue.
 */
export function cancelRSVP(userId: string, venueId: string): VenueRSVP {
  return {
    userId,
    venueId,
    timestamp: new Date().toISOString(),
    status: 'cancelled',
  }
}

/**
 * Aggregate RSVPs for a venue on a given date.
 * Returns active (going/maybe) RSVPs, deduped by user (latest wins).
 */
export function getVenueNightPlan(
  venueId: string,
  date: string,
  allRsvps: VenueRSVP[],
  users: User[]
): VenueNightPlan {
  const userMap = new Map(users.map(u => [u.id, u]))

  // Filter RSVPs for this venue, dedupe by user (latest timestamp wins)
  const venueRsvps = allRsvps.filter(r => r.venueId === venueId)
  const latestByUser = deduplicateRsvps(venueRsvps)

  // Only active RSVPs
  const activeRsvps = latestByUser.filter(r => r.status === 'going' || r.status === 'maybe')
  const goingRsvps = latestByUser.filter(r => r.status === 'going')

  const friendsGoing = goingRsvps
    .map(r => userMap.get(r.userId))
    .filter((u): u is User => u !== undefined)

  return {
    venueId,
    date,
    rsvps: activeRsvps,
    friendsGoing,
    totalGoing: goingRsvps.length,
  }
}

/**
 * Get which friends are going where tonight.
 * Returns a map of venueId -> list of friend RSVPs.
 */
export function getFriendsGoingTonight(
  userId: string,
  friendIds: string[],
  allRsvps: VenueRSVP[]
): Map<string, VenueRSVP[]> {
  const friendSet = new Set(friendIds)
  const friendRsvps = allRsvps.filter(r => friendSet.has(r.userId))

  // Deduplicate first (per user per venue, keep latest), then filter active
  const deduped = deduplicateRsvps(friendRsvps)

  const byVenue = new Map<string, VenueRSVP[]>()
  for (const rsvp of deduped) {
    if (rsvp.status === 'cancelled') continue
    const existing = byVenue.get(rsvp.venueId) ?? []
    existing.push(rsvp)
    byVenue.set(rsvp.venueId, existing)
  }

  return byVenue
}

/**
 * Generate a notification message for when a user RSVPs.
 * "Sarah is heading to The Rooftop — 2 friends already going"
 */
export function generateGoingNotification(
  user: User,
  venue: Venue,
  friendsAlreadyGoing: User[]
): string {
  const base = `${user.username} is heading to ${venue.name}`

  if (friendsAlreadyGoing.length === 0) {
    return base
  }

  if (friendsAlreadyGoing.length === 1) {
    return `${base} — 1 friend already going`
  }

  return `${base} — ${friendsAlreadyGoing.length} friends already going`
}

/**
 * Rank venues by RSVP count tonight.
 * Returns venues sorted by number of 'going' RSVPs (descending).
 */
export function getPopularVenuesTonight(
  allRsvps: VenueRSVP[],
  venues: Venue[]
): (Venue & { goingCount: number })[] {
  const venueMap = new Map(venues.map(v => [v.id, v]))
  const deduped = deduplicateRsvps(allRsvps)

  // Count going RSVPs per venue
  const counts = new Map<string, number>()
  for (const rsvp of deduped) {
    if (rsvp.status !== 'going') continue
    counts.set(rsvp.venueId, (counts.get(rsvp.venueId) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .filter(([venueId]) => venueMap.has(venueId))
    .map(([venueId, count]) => ({
      ...venueMap.get(venueId)!,
      goingCount: count,
    }))
    .sort((a, b) => b.goingCount - a.goingCount)
}

/**
 * Suggest venues based on where the user's friends are going.
 * "Your friends are going here" — returns venues with most friend RSVPs
 * that the user is NOT already going to.
 */
export function getSuggestedVenues(
  userId: string,
  friendRsvps: VenueRSVP[],
  venues: Venue[]
): (Venue & { friendCount: number })[] {
  const venueMap = new Map(venues.map(v => [v.id, v]))
  const deduped = deduplicateRsvps(friendRsvps)

  // Only active friend RSVPs (not the user's own)
  const activeFriendRsvps = deduped.filter(
    r => r.userId !== userId && (r.status === 'going' || r.status === 'maybe')
  )

  const friendCounts = new Map<string, number>()
  for (const rsvp of activeFriendRsvps) {
    friendCounts.set(rsvp.venueId, (friendCounts.get(rsvp.venueId) ?? 0) + 1)
  }

  return Array.from(friendCounts.entries())
    .filter(([venueId]) => venueMap.has(venueId))
    .map(([venueId, count]) => ({
      ...venueMap.get(venueId)!,
      friendCount: count,
    }))
    .sort((a, b) => b.friendCount - a.friendCount)
}

// ── Internal Helpers ─────────────────────────────────────────

/**
 * Deduplicate RSVPs: per (userId, venueId) pair, keep only the latest by timestamp.
 */
function deduplicateRsvps(rsvps: VenueRSVP[]): VenueRSVP[] {
  const latest = new Map<string, VenueRSVP>()

  for (const rsvp of rsvps) {
    const key = `${rsvp.userId}:${rsvp.venueId}`
    const existing = latest.get(key)
    if (!existing || new Date(rsvp.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      latest.set(key, rsvp)
    }
  }

  return Array.from(latest.values())
}

export { deduplicateRsvps as _deduplicateRsvps }
