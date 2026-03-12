import type { Pulse, User } from './types'

/**
 * Creator Economy Engine
 *
 * Creator profiles, tier system, attribution tracking,
 * tipping, and creator analytics.
 */

export type CreatorTier = 'rising' | 'verified' | 'elite'

export interface CreatorBadge {
  id: string
  label: string
  icon: string
  earnedAt: string
}

export interface CreatorProfile {
  userId: string
  tier: CreatorTier
  followers: string[]
  totalPulses: number
  totalReactions: number
  totalViews: number
  attributedVisits: number
  earnings: {
    tips: number
    sponsorships: number
    challenges: number
  }
  joinedAt: string
  verifiedAt?: string
  badges: CreatorBadge[]
}

export interface CreatorStats {
  reach: number
  engagementRate: number
  attributedVenueVisits: number
  topPerformingPulses: {
    pulseId: string
    venueId: string
    reactions: number
    views: number
    createdAt: string
  }[]
  audienceDemographics: {
    topVenueCategories: string[]
    peakActivityHour: number
    avgEnergyRating: string
  }
}

export interface Attribution {
  id: string
  pulseId: string
  venueId: string
  creatorId: string
  visitUserId: string
  createdAt: string
}

export interface Tip {
  id: string
  fromUserId: string
  toCreatorId: string
  amount: number
  platformFee: number
  netAmount: number
  pulseId?: string
  message?: string
  createdAt: string
}

export interface TipJar {
  creatorId: string
  totalTips: number
  tipHistory: Tip[]
  withdrawable: number
}

export const PLATFORM_FEE_RATE = 0.15

export const CREATOR_TIER_REQUIREMENTS: Record<CreatorTier, {
  minPulses: number
  minReactions: number
  minFollowers: number
  unlocks: string[]
}> = {
  rising: {
    minPulses: 50,
    minReactions: 500,
    minFollowers: 0,
    unlocks: ['tip_jar'],
  },
  verified: {
    minPulses: 200,
    minReactions: 2000,
    minFollowers: 100,
    unlocks: ['sponsorships', 'verified_badge'],
  },
  elite: {
    minPulses: 500,
    minReactions: 10000,
    minFollowers: 1000,
    unlocks: ['exclusive_challenges', 'featured_placement'],
  },
}

/**
 * Calculate a user's creator tier based on their stats.
 */
export function calculateCreatorTier(
  totalPulses: number,
  totalReactions: number,
  followers: number
): CreatorTier | null {
  if (
    totalPulses >= CREATOR_TIER_REQUIREMENTS.elite.minPulses &&
    totalReactions >= CREATOR_TIER_REQUIREMENTS.elite.minReactions &&
    followers >= CREATOR_TIER_REQUIREMENTS.elite.minFollowers
  ) {
    return 'elite'
  }
  if (
    totalPulses >= CREATOR_TIER_REQUIREMENTS.verified.minPulses &&
    totalReactions >= CREATOR_TIER_REQUIREMENTS.verified.minReactions &&
    followers >= CREATOR_TIER_REQUIREMENTS.verified.minFollowers
  ) {
    return 'verified'
  }
  if (
    totalPulses >= CREATOR_TIER_REQUIREMENTS.rising.minPulses &&
    totalReactions >= CREATOR_TIER_REQUIREMENTS.rising.minReactions
  ) {
    return 'rising'
  }
  return null
}

/**
 * Get the total reaction count for a pulse.
 */
function getPulseReactionCount(pulse: Pulse): number {
  return (
    pulse.reactions.fire.length +
    pulse.reactions.eyes.length +
    pulse.reactions.skull.length +
    pulse.reactions.lightning.length
  )
}

/**
 * Build a creator profile from user data and their pulses.
 */
export function buildCreatorProfile(
  user: User,
  userPulses: Pulse[],
  followers: string[],
  attributions: Attribution[],
  tipJar: TipJar | null,
  challengeEarnings: number = 0
): CreatorProfile | null {
  const totalReactions = userPulses.reduce(
    (sum, p) => sum + getPulseReactionCount(p),
    0
  )
  const totalViews = userPulses.reduce((sum, p) => sum + p.views, 0)

  const tier = calculateCreatorTier(userPulses.length, totalReactions, followers.length)
  if (!tier) return null

  const userAttributions = attributions.filter(a => a.creatorId === user.id)
  const badges: CreatorBadge[] = []

  if (tier === 'verified' || tier === 'elite') {
    badges.push({
      id: 'verified',
      label: 'Verified Creator',
      icon: 'check-circle',
      earnedAt: new Date().toISOString(),
    })
  }
  if (tier === 'elite') {
    badges.push({
      id: 'elite',
      label: 'Elite Creator',
      icon: 'star',
      earnedAt: new Date().toISOString(),
    })
  }

  return {
    userId: user.id,
    tier,
    followers,
    totalPulses: userPulses.length,
    totalReactions,
    totalViews,
    attributedVisits: userAttributions.length,
    earnings: {
      tips: tipJar?.totalTips ?? 0,
      sponsorships: 0,
      challenges: challengeEarnings,
    },
    joinedAt: user.createdAt,
    verifiedAt: tier === 'verified' || tier === 'elite' ? new Date().toISOString() : undefined,
    badges,
  }
}

/**
 * Get creator analytics/stats.
 */
export function getCreatorStats(
  userId: string,
  userPulses: Pulse[],
  attributions: Attribution[]
): CreatorStats {
  const totalReactions = userPulses.reduce(
    (sum, p) => sum + getPulseReactionCount(p),
    0
  )
  const totalViews = userPulses.reduce((sum, p) => sum + p.views, 0)

  const engagementRate = totalViews > 0 ? (totalReactions / totalViews) * 100 : 0

  const userAttributions = attributions.filter(a => a.creatorId === userId)

  // Top performing pulses
  const topPulses = [...userPulses]
    .sort((a, b) => getPulseReactionCount(b) - getPulseReactionCount(a))
    .slice(0, 5)
    .map(p => ({
      pulseId: p.id,
      venueId: p.venueId,
      reactions: getPulseReactionCount(p),
      views: p.views,
      createdAt: p.createdAt,
    }))

  // Audience demographics
  const venueCounts: Record<string, number> = {}
  for (const p of userPulses) {
    venueCounts[p.venueId] = (venueCounts[p.venueId] ?? 0) + 1
  }
  const topVenueCategories = Object.entries(venueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([venueId]) => venueId)

  // Peak activity hour
  const hourCounts: Record<number, number> = {}
  for (const p of userPulses) {
    const hour = new Date(p.createdAt).getHours()
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
  }
  const peakHour = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)[0]
  const peakActivityHour = peakHour ? parseInt(peakHour[0]) : 21

  // Average energy
  const energyValues = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
  const avgEnergy = userPulses.length > 0
    ? userPulses.reduce((sum, p) => sum + energyValues[p.energyRating], 0) / userPulses.length
    : 0
  const avgEnergyRating = avgEnergy >= 2.5 ? 'electric' : avgEnergy >= 1.5 ? 'buzzing' : avgEnergy >= 0.5 ? 'chill' : 'dead'

  return {
    reach: totalViews,
    engagementRate: Math.round(engagementRate * 100) / 100,
    attributedVenueVisits: userAttributions.length,
    topPerformingPulses: topPulses,
    audienceDemographics: {
      topVenueCategories,
      peakActivityHour,
      avgEnergyRating,
    },
  }
}

/**
 * Track attribution when someone visits a venue after seeing a creator's pulse.
 */
export function trackAttribution(
  pulseId: string,
  venueId: string,
  creatorId: string,
  visitUserId: string
): Attribution {
  return {
    id: `attr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pulseId,
    venueId,
    creatorId,
    visitUserId,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Send a tip from one user to a creator.
 */
export function sendTip(
  fromUserId: string,
  toCreatorId: string,
  amount: number,
  pulseId?: string,
  message?: string
): Tip {
  const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100
  const netAmount = Math.round((amount - platformFee) * 100) / 100

  return {
    id: `tip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromUserId,
    toCreatorId,
    amount,
    platformFee,
    netAmount,
    pulseId,
    message,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Build or update a tip jar for a creator.
 */
export function updateTipJar(
  currentTipJar: TipJar | null,
  newTip: Tip
): TipJar {
  if (!currentTipJar) {
    return {
      creatorId: newTip.toCreatorId,
      totalTips: newTip.netAmount,
      tipHistory: [newTip],
      withdrawable: newTip.netAmount,
    }
  }

  return {
    ...currentTipJar,
    totalTips: Math.round((currentTipJar.totalTips + newTip.netAmount) * 100) / 100,
    tipHistory: [newTip, ...currentTipJar.tipHistory],
    withdrawable: Math.round((currentTipJar.withdrawable + newTip.netAmount) * 100) / 100,
  }
}

/**
 * Calculate tier progress as a percentage toward the next tier.
 */
export function getCreatorTierProgress(
  totalPulses: number,
  totalReactions: number,
  followers: number
): {
  currentTier: CreatorTier | null
  nextTier: CreatorTier | null
  progress: number
  pulsesProgress: number
  reactionsProgress: number
  followersProgress: number
} {
  const currentTier = calculateCreatorTier(totalPulses, totalReactions, followers)

  const tiers: (CreatorTier | null)[] = [null, 'rising', 'verified', 'elite']
  const currentIndex = tiers.indexOf(currentTier)
  const nextTier = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] as CreatorTier : null

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      progress: 100,
      pulsesProgress: 100,
      reactionsProgress: 100,
      followersProgress: 100,
    }
  }

  const req = CREATOR_TIER_REQUIREMENTS[nextTier]
  const pulsesProgress = Math.min(100, Math.round((totalPulses / req.minPulses) * 100))
  const reactionsProgress = Math.min(100, Math.round((totalReactions / req.minReactions) * 100))
  const followersProgress = req.minFollowers > 0
    ? Math.min(100, Math.round((followers / req.minFollowers) * 100))
    : 100

  const progress = Math.round((pulsesProgress + reactionsProgress + followersProgress) / 3)

  return {
    currentTier,
    nextTier,
    progress,
    pulsesProgress,
    reactionsProgress,
    followersProgress,
  }
}

/**
 * Check if a user qualifies as a creator (meets at least rising tier).
 */
export function isCreator(
  totalPulses: number,
  totalReactions: number
): boolean {
  return calculateCreatorTier(totalPulses, totalReactions, 0) !== null
}
