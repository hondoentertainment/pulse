import type { User, Pulse } from './types'

/**
 * Social Graph Engine
 *
 * Friend discovery, QR/share link generation, "people you may know"
 * based on co-located check-ins, and daily friend activity digests.
 */

export interface FriendSuggestion {
  user: User
  reason: FriendSuggestionReason
  score: number
}

export type FriendSuggestionReason =
  | { type: 'co_located'; venueCount: number; venueName?: string }
  | { type: 'mutual_friends'; count: number }
  | { type: 'same_venues'; venueCount: number }

export interface FriendActivityDigest {
  date: string
  entries: FriendActivityEntry[]
}

export interface FriendActivityEntry {
  userId: string
  username: string
  profilePhoto?: string
  venues: {
    venueId: string
    venueName: string
    energyRating: string
    timestamp: string
  }[]
}

export interface ShareLink {
  type: 'friend_invite' | 'venue_share' | 'pulse_share'
  code: string
  url: string
  createdAt: string
  createdBy: string
  referralId?: string
}

/**
 * Generate a unique share/invite code.
 */
function generateCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Find "People you may know" based on co-located check-ins.
 *
 * Two users are co-located if they pulsed at the same venue within
 * a configurable time window.
 */
export function getPeopleYouMayKnow(
  currentUser: User,
  allUsers: User[],
  pulses: Pulse[],
  coPresenceWindowMins: number = 90,
  limit: number = 10
): FriendSuggestion[] {
  const friendSet = new Set(currentUser.friends)
  const candidates = allUsers.filter(u => u.id !== currentUser.id && !friendSet.has(u.id))

  const myPulses = pulses.filter(p => p.userId === currentUser.id)
  const suggestions: Map<string, FriendSuggestion> = new Map()

  for (const candidate of candidates) {
    let coLocatedVenues = 0
    let lastVenueName: string | undefined
    let mutualFriends = 0
    let sameVenues = 0

    // 1. Co-location analysis
    const candidatePulses = pulses.filter(p => p.userId === candidate.id)
    const coLocatedVenueSet = new Set<string>()

    for (const myPulse of myPulses) {
      for (const theirPulse of candidatePulses) {
        if (myPulse.venueId !== theirPulse.venueId) continue

        const timeDiff = Math.abs(
          new Date(myPulse.createdAt).getTime() - new Date(theirPulse.createdAt).getTime()
        ) / 60000

        if (timeDiff <= coPresenceWindowMins) {
          coLocatedVenueSet.add(myPulse.venueId)
          lastVenueName = myPulse.venueId // Will be resolved to name by caller
        }
      }
    }
    coLocatedVenues = coLocatedVenueSet.size

    // 2. Mutual friends
    for (const friendId of candidate.friends) {
      if (friendSet.has(friendId)) mutualFriends++
    }

    // 3. Same venues (not co-located, just both frequent)
    const myVenues = new Set(myPulses.map(p => p.venueId))
    const theirVenues = new Set(candidatePulses.map(p => p.venueId))
    for (const v of myVenues) {
      if (theirVenues.has(v)) sameVenues++
    }

    // Score and pick best reason
    let score = 0
    let reason: FriendSuggestionReason

    if (coLocatedVenues > 0) {
      score = coLocatedVenues * 30 + mutualFriends * 10
      reason = { type: 'co_located', venueCount: coLocatedVenues, venueName: lastVenueName }
    } else if (mutualFriends >= 2) {
      score = mutualFriends * 15
      reason = { type: 'mutual_friends', count: mutualFriends }
    } else if (sameVenues >= 2) {
      score = sameVenues * 10
      reason = { type: 'same_venues', venueCount: sameVenues }
    } else {
      continue
    }

    suggestions.set(candidate.id, { user: candidate, reason, score })
  }

  return Array.from(suggestions.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Format a friend suggestion reason as a human-readable string.
 */
export function formatSuggestionReason(reason: FriendSuggestionReason): string {
  switch (reason.type) {
    case 'co_located':
      if (reason.venueCount === 1) return 'You were at the same venue recently'
      return `Spotted at ${reason.venueCount} same venues`
    case 'mutual_friends':
      return `${reason.count} mutual friend${reason.count > 1 ? 's' : ''}`
    case 'same_venues':
      return `You both frequent ${reason.venueCount} same spots`
  }
}

/**
 * Generate a friend activity digest for the past 24 hours.
 */
export function generateActivityDigest(
  currentUser: User,
  allUsers: User[],
  pulses: Pulse[],
  venues: { id: string; name: string }[],
  windowHours: number = 24
): FriendActivityDigest {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000
  const friendSet = new Set(currentUser.friends)
  const venueMap = new Map(venues.map(v => [v.id, v.name]))
  const userMap = new Map(allUsers.map(u => [u.id, u]))

  const friendPulses = pulses
    .filter(p => friendSet.has(p.userId) && new Date(p.createdAt).getTime() > cutoff)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Group by user
  const byUser = new Map<string, FriendActivityEntry>()
  for (const pulse of friendPulses) {
    if (!byUser.has(pulse.userId)) {
      const user = userMap.get(pulse.userId)
      byUser.set(pulse.userId, {
        userId: pulse.userId,
        username: user?.username ?? 'Unknown',
        profilePhoto: user?.profilePhoto,
        venues: [],
      })
    }

    const entry = byUser.get(pulse.userId)!
    // Deduplicate same venue
    if (!entry.venues.some(v => v.venueId === pulse.venueId)) {
      entry.venues.push({
        venueId: pulse.venueId,
        venueName: venueMap.get(pulse.venueId) ?? 'Unknown venue',
        energyRating: pulse.energyRating,
        timestamp: pulse.createdAt,
      })
    }
  }

  return {
    date: new Date().toISOString().split('T')[0],
    entries: Array.from(byUser.values()),
  }
}

/**
 * Create a friend invite share link.
 */
export function createFriendInviteLink(userId: string, baseUrl: string = 'https://pulse.app'): ShareLink {
  const code = generateCode()
  return {
    type: 'friend_invite',
    code,
    url: `${baseUrl}/invite/${code}`,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    referralId: `ref-${userId}-${code}`,
  }
}

/**
 * Create a venue share link.
 */
export function createVenueShareLink(venueId: string, userId: string, baseUrl: string = 'https://pulse.app'): ShareLink {
  const code = generateCode()
  return {
    type: 'venue_share',
    code,
    url: `${baseUrl}/venue/${venueId}?ref=${code}`,
    createdAt: new Date().toISOString(),
    createdBy: userId,
  }
}

/**
 * Create a pulse share link.
 */
export function createPulseShareLink(pulseId: string, userId: string, baseUrl: string = 'https://pulse.app'): ShareLink {
  const code = generateCode()
  return {
    type: 'pulse_share',
    code,
    url: `${baseUrl}/pulse/${pulseId}?ref=${code}`,
    createdAt: new Date().toISOString(),
    createdBy: userId,
  }
}

/**
 * Generate QR code data payload for friend adding at venues.
 * Returns a JSON string that can be encoded into a QR code.
 */
export function generateFriendQRPayload(userId: string, username: string): string {
  return JSON.stringify({
    type: 'pulse_friend_add',
    userId,
    username,
    ts: Date.now(),
  })
}

/**
 * Parse a QR code payload for friend adding.
 */
export function parseFriendQRPayload(payload: string): { userId: string; username: string } | null {
  try {
    const data = JSON.parse(payload)
    if (data.type !== 'pulse_friend_add') return null
    if (!data.userId || !data.username) return null
    // QR codes expire after 5 minutes
    if (Date.now() - data.ts > 5 * 60 * 1000) return null
    return { userId: data.userId, username: data.username }
  } catch {
    return null
  }
}
