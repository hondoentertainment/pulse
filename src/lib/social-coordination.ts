import type { User, Venue, Pulse, EnergyRating } from './types'
import { calculateDistance } from './pulse-engine'

/**
 * Social Coordination Engine
 *
 * Group polls for venue selection, friend activity timelines,
 * equidistant meet-up suggestions, and social proof signals.
 */

// ── Group Polls ──────────────────────────────────────────────

export interface GroupPoll {
  id: string
  creatorId: string
  title: string
  venueOptions: {
    venueId: string
    venueName: string
    votes: string[]
  }[]
  createdAt: string
  expiresAt: string
  status: 'active' | 'closed'
}

/**
 * Create a new group poll for venue selection.
 * Default expiry is 2 hours.
 */
export function createGroupPoll(
  creatorId: string,
  title: string,
  venueIds: string[],
  venueNames: string[],
  expiryMinutes: number = 120
): GroupPoll {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000)

  return {
    id: `poll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    creatorId,
    title,
    venueOptions: venueIds.map((id, i) => ({
      venueId: id,
      venueName: venueNames[i] ?? 'Unknown venue',
      votes: [],
    })),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'active',
  }
}

/**
 * Cast a vote on a poll. Each user can only vote once; re-voting
 * moves the vote to the new option.
 */
export function voteOnPoll(
  poll: GroupPoll,
  venueId: string,
  userId: string
): GroupPoll {
  if (poll.status === 'closed') return poll

  const updatedOptions = poll.venueOptions.map(option => ({
    ...option,
    // Remove previous vote by this user from all options
    votes: option.votes.filter(id => id !== userId),
  })).map(option => ({
    ...option,
    // Add vote to target option
    votes: option.venueId === venueId
      ? [...option.votes, userId]
      : option.votes,
  }))

  return { ...poll, venueOptions: updatedOptions }
}

/**
 * Get the winning venue (most votes). Returns null if no votes cast.
 * Ties are broken by option order (first listed wins).
 */
export function getPollWinner(poll: GroupPoll): string | null {
  let maxVotes = 0
  let winnerId: string | null = null

  for (const option of poll.venueOptions) {
    if (option.votes.length > maxVotes) {
      maxVotes = option.votes.length
      winnerId = option.venueId
    }
  }

  return winnerId
}

/**
 * Close a poll so no further votes can be cast.
 */
export function closePoll(poll: GroupPoll): GroupPoll {
  return { ...poll, status: 'closed' }
}

// ── Friend Activity Timeline ─────────────────────────────────

export interface FriendActivityEntry {
  userId: string
  username: string
  profilePhoto?: string
  venueId: string
  venueName: string
  action: 'check_in' | 'pulse' | 'reaction'
  timestamp: string
  energyRating?: EnergyRating
}

/**
 * Build a chronological timeline of friend activity from pulses.
 * Returns entries sorted newest-first.
 */
export function getFriendTimeline(
  userId: string,
  friends: User[],
  pulses: Pulse[],
  venues: Venue[],
  windowHours: number = 72
): FriendActivityEntry[] {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000
  const friendSet = new Set(friends.map(f => f.id))
  const friendMap = new Map(friends.map(f => [f.id, f]))
  const venueMap = new Map(venues.map(v => [v.id, v]))

  const entries: FriendActivityEntry[] = []

  for (const pulse of pulses) {
    const createdTime = new Date(pulse.createdAt).getTime()
    if (createdTime < cutoff) continue

    // Friend posted a pulse → check_in + pulse entry
    if (friendSet.has(pulse.userId)) {
      const friend = friendMap.get(pulse.userId)!
      const venue = venueMap.get(pulse.venueId)

      entries.push({
        userId: pulse.userId,
        username: friend.username,
        profilePhoto: friend.profilePhoto,
        venueId: pulse.venueId,
        venueName: venue?.name ?? 'Unknown venue',
        action: 'pulse',
        timestamp: pulse.createdAt,
        energyRating: pulse.energyRating,
      })
    }

    // Friends who reacted to the current user's pulses
    if (pulse.userId === userId) {
      const allReactions = [
        ...pulse.reactions.fire,
        ...pulse.reactions.eyes,
        ...pulse.reactions.skull,
        ...pulse.reactions.lightning,
      ]

      for (const reactorId of allReactions) {
        if (!friendSet.has(reactorId)) continue
        const friend = friendMap.get(reactorId)!
        const venue = venueMap.get(pulse.venueId)

        entries.push({
          userId: reactorId,
          username: friend.username,
          profilePhoto: friend.profilePhoto,
          venueId: pulse.venueId,
          venueName: venue?.name ?? 'Unknown venue',
          action: 'reaction',
          timestamp: pulse.createdAt,
        })
      }
    }
  }

  // Deduplicate: same user + same venue + same action within 30 min
  const deduped: FriendActivityEntry[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const timeBlock = Math.floor(new Date(entry.timestamp).getTime() / (30 * 60 * 1000))
    const key = `${entry.userId}-${entry.venueId}-${entry.action}-${timeBlock}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(entry)
  }

  return deduped.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

// ── Meet-Up Suggestions ──────────────────────────────────────

interface FriendLocation {
  lat: number
  lng: number
}

/**
 * Find venues that are roughly equidistant from all friends.
 * Scores venues by how balanced travel distances are (lower variance = better).
 */
export function findMeetUpVenues(
  friendLocations: FriendLocation[],
  venues: Venue[],
  maxResults: number = 3
): Venue[] {
  if (friendLocations.length === 0 || venues.length === 0) return []

  // Calculate centroid of friend locations
  const centroid = {
    lat: friendLocations.reduce((sum, loc) => sum + loc.lat, 0) / friendLocations.length,
    lng: friendLocations.reduce((sum, loc) => sum + loc.lng, 0) / friendLocations.length,
  }

  // Score each venue by distance from centroid + fairness (low variance in distances)
  const scored = venues.map(venue => {
    const distances = friendLocations.map(loc =>
      calculateDistance(loc.lat, loc.lng, venue.location.lat, venue.location.lng)
    )

    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length
    const centroidDistance = calculateDistance(centroid.lat, centroid.lng, venue.location.lat, venue.location.lng)

    // Lower score = better. Penalize large variance (unfairness) and distance from centroid.
    const score = centroidDistance + Math.sqrt(variance) * 2

    return { venue, score, distances }
  })

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, maxResults)
    .map(s => s.venue)
}

/**
 * Get distance from a venue to each friend location.
 */
export function getDistancesToVenue(
  venue: Venue,
  friendLocations: FriendLocation[]
): number[] {
  return friendLocations.map(loc =>
    calculateDistance(loc.lat, loc.lng, venue.location.lat, venue.location.lng)
  )
}

// ── Social Proof ─────────────────────────────────────────────

export interface SocialProof {
  friendVisitsThisWeek: number
  isFavoriteInCircle: boolean
  trendingInCircle: boolean
  label: string
}

/**
 * Calculate social proof signals for a venue based on friend activity.
 */
export function getSocialProofForVenue(
  venueId: string,
  userId: string,
  friends: User[],
  pulses: Pulse[]
): SocialProof {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const friendIds = new Set(friends.map(f => f.id))

  // Count friend visits this week
  const friendPulsesThisWeek = pulses.filter(
    p =>
      p.venueId === venueId &&
      friendIds.has(p.userId) &&
      new Date(p.createdAt).getTime() > oneWeekAgo
  )

  const uniqueFriendVisitors = new Set(friendPulsesThisWeek.map(p => p.userId))
  const friendVisitsThisWeek = uniqueFriendVisitors.size

  // Is this a circle favorite? (3+ friends visited in the past week)
  const isFavoriteInCircle = friendVisitsThisWeek >= 3

  // Is it trending in the circle? (2+ friends visited in the last 24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
  const recentFriendVisitors = new Set(
    friendPulsesThisWeek
      .filter(p => new Date(p.createdAt).getTime() > oneDayAgo)
      .map(p => p.userId)
  )
  const trendingInCircle = recentFriendVisitors.size >= 2

  // Build human-readable label
  let label = ''
  if (isFavoriteInCircle) {
    label = "Your crew's favorite"
  } else if (trendingInCircle) {
    label = 'Trending in your circle'
  } else if (friendVisitsThisWeek > 0) {
    label = `${friendVisitsThisWeek} friend${friendVisitsThisWeek === 1 ? '' : 's'} went this week`
  }

  return {
    friendVisitsThisWeek,
    isFavoriteInCircle,
    trendingInCircle,
    label,
  }
}
