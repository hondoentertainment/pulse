import type { Pulse } from './types'

/**
 * Venue Challenges — Sponsored Challenges Engine
 *
 * Venue-sponsored challenges where creators/users can earn rewards
 * by completing specific tasks at venues.
 */

export type ChallengeRewardType = 'cash' | 'vip-access' | 'free-drinks' | 'merch'
export type ChallengeStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface ChallengeRequirements {
  visitVenue: boolean
  postPulse: boolean
  minEnergyRating?: 'chill' | 'buzzing' | 'electric'
  useHashtag?: string
  includePhoto: boolean
  minGroupSize?: number
  visitCount?: number
}

export interface ChallengeReward {
  type: ChallengeRewardType
  value: number
  description: string
}

export interface ChallengeEntry {
  userId: string
  pulseId?: string
  submittedAt: string
  reactions: number
  verified: boolean
}

export interface VenueChallenge {
  id: string
  venueId: string
  sponsorVenueName: string
  title: string
  description: string
  challengeType: 'post-from-venue' | 'best-vibe-shot' | 'bring-your-crew' | 'weekly-regular'
  requirements: ChallengeRequirements
  reward: ChallengeReward
  startDate: string
  endDate: string
  maxParticipants: number
  participants: string[]
  entries: ChallengeEntry[]
  budget: number
  status: ChallengeStatus
  createdAt: string
}

export interface ChallengeLeaderboardEntry {
  userId: string
  pulseId?: string
  reactions: number
  rank: number
}

/**
 * Create a new venue challenge.
 */
export function createChallenge(
  venueId: string,
  sponsorVenueName: string,
  title: string,
  description: string,
  challengeType: VenueChallenge['challengeType'],
  requirements: ChallengeRequirements,
  reward: ChallengeReward,
  durationDays: number,
  maxParticipants: number,
  budget: number
): VenueChallenge {
  const now = new Date()
  const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

  return {
    id: `challenge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    sponsorVenueName,
    title,
    description,
    challengeType,
    requirements,
    reward,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    maxParticipants,
    participants: [],
    entries: [],
    budget,
    status: 'active',
    createdAt: now.toISOString(),
  }
}

/**
 * Join a challenge. Returns updated challenge or null if can't join.
 */
export function joinChallenge(
  challenge: VenueChallenge,
  userId: string
): VenueChallenge | null {
  if (challenge.status !== 'active') return null
  if (challenge.participants.includes(userId)) return null
  if (challenge.participants.length >= challenge.maxParticipants) return null
  if (new Date(challenge.endDate).getTime() < Date.now()) return null

  return {
    ...challenge,
    participants: [...challenge.participants, userId],
  }
}

/**
 * Submit an entry for a challenge.
 */
export function submitChallengeEntry(
  challenge: VenueChallenge,
  userId: string,
  pulse: Pulse
): VenueChallenge | null {
  if (challenge.status !== 'active') return null
  if (!challenge.participants.includes(userId)) return null
  if (new Date(challenge.endDate).getTime() < Date.now()) return null

  // Validate requirements
  if (challenge.requirements.visitVenue && pulse.venueId !== challenge.venueId) return null
  if (challenge.requirements.includePhoto && pulse.photos.length === 0) return null
  if (challenge.requirements.minEnergyRating) {
    const energyOrder = ['dead', 'chill', 'buzzing', 'electric']
    const requiredLevel = energyOrder.indexOf(challenge.requirements.minEnergyRating)
    const pulseLevel = energyOrder.indexOf(pulse.energyRating)
    if (pulseLevel < requiredLevel) return null
  }
  if (challenge.requirements.useHashtag) {
    const hasHashtag = pulse.hashtags?.some(
      h => h.toLowerCase() === challenge.requirements.useHashtag!.toLowerCase()
    )
    if (!hasHashtag) return null
  }

  const reactions =
    pulse.reactions.fire.length +
    pulse.reactions.eyes.length +
    pulse.reactions.skull.length +
    pulse.reactions.lightning.length

  const entry: ChallengeEntry = {
    userId,
    pulseId: pulse.id,
    submittedAt: new Date().toISOString(),
    reactions,
    verified: true,
  }

  return {
    ...challenge,
    entries: [...challenge.entries, entry],
  }
}

/**
 * Evaluate a challenge and determine winners.
 * For 'best-vibe-shot' — winner is by most reactions.
 * For others — all who completed the requirements win.
 */
export function evaluateChallenge(
  challenge: VenueChallenge,
  allPulses: Pulse[]
): VenueChallenge {
  if (challenge.status !== 'active') return challenge

  // Update entry reaction counts from latest pulse data
  const updatedEntries = challenge.entries.map(entry => {
    if (!entry.pulseId) return entry
    const pulse = allPulses.find(p => p.id === entry.pulseId)
    if (!pulse) return entry
    return {
      ...entry,
      reactions:
        pulse.reactions.fire.length +
        pulse.reactions.eyes.length +
        pulse.reactions.skull.length +
        pulse.reactions.lightning.length,
    }
  })

  return {
    ...challenge,
    entries: updatedEntries,
    status: 'completed',
  }
}

/**
 * Get challenge leaderboard ranked by reactions/engagement.
 */
export function getChallengeLeaderboard(
  challenge: VenueChallenge
): ChallengeLeaderboardEntry[] {
  return challenge.entries
    .filter(e => e.verified)
    .sort((a, b) => b.reactions - a.reactions)
    .map((entry, index) => ({
      userId: entry.userId,
      pulseId: entry.pulseId,
      reactions: entry.reactions,
      rank: index + 1,
    }))
}

/**
 * Get active challenges (not expired, not cancelled).
 */
export function getActiveChallenges(
  challenges: VenueChallenge[]
): VenueChallenge[] {
  const now = Date.now()
  return challenges.filter(
    c => c.status === 'active' && new Date(c.endDate).getTime() > now
  )
}

/**
 * Get challenges a user has joined.
 */
export function getUserActiveChallenges(
  challenges: VenueChallenge[],
  userId: string
): VenueChallenge[] {
  return getActiveChallenges(challenges).filter(c => c.participants.includes(userId))
}

/**
 * Calculate time remaining for a challenge.
 */
export function getChallengeTimeRemaining(
  challenge: VenueChallenge
): { days: number; hours: number; expired: boolean } {
  const remaining = new Date(challenge.endDate).getTime() - Date.now()
  if (remaining <= 0) return { days: 0, hours: 0, expired: true }

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000))
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  return { days, hours, expired: false }
}

/**
 * Create demo challenges for seed data.
 */
export function createDemoChallenges(
  venues: { id: string; name: string }[]
): VenueChallenge[] {
  if (venues.length < 3) return []

  return [
    createChallenge(
      venues[0].id,
      venues[0].name,
      'Friday Night Vibes',
      'Post from our venue on Friday night and share the energy!',
      'post-from-venue',
      { visitVenue: true, postPulse: true, includePhoto: true },
      { type: 'free-drinks', value: 25, description: '2 free cocktails' },
      7,
      50,
      500
    ),
    createChallenge(
      venues[1].id,
      venues[1].name,
      'Best Vibe Shot Contest',
      'Capture the best vibe photo at our venue. Most reactions wins!',
      'best-vibe-shot',
      { visitVenue: true, postPulse: true, includePhoto: true, minEnergyRating: 'buzzing' },
      { type: 'cash', value: 100, description: '$100 cash prize' },
      14,
      100,
      200
    ),
    createChallenge(
      venues[2].id,
      venues[2].name,
      'Squad Goals',
      'Bring 3+ friends and check in together for VIP treatment!',
      'bring-your-crew',
      { visitVenue: true, postPulse: true, includePhoto: true, minGroupSize: 3 },
      { type: 'vip-access', value: 50, description: 'VIP table for your crew' },
      7,
      30,
      300
    ),
  ]
}
