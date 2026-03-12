import type { CreatorProfile, CreatorStats } from './creator-economy'

/**
 * Brand Partnerships — Marketplace connecting venues with creators
 *
 * Partnership proposals, deliverable tracking, ROI calculation,
 * and creator-venue matching.
 */

export type PartnershipType = 'one-time' | 'recurring'
export type PartnershipStatus = 'proposed' | 'accepted' | 'active' | 'completed' | 'cancelled'

export interface PartnershipDeliverables {
  pulseCount: number
  storyCount: number
  hashtags: string[]
}

export interface PartnershipMetrics {
  impressions: number
  engagements: number
  attributedVisits: number
}

export interface Partnership {
  id: string
  venueId: string
  venueName: string
  creatorId: string
  type: PartnershipType
  deliverables: PartnershipDeliverables
  compensation: number
  status: PartnershipStatus
  metrics: PartnershipMetrics
  completedDeliverables: {
    pulsesPosted: number
    storiesPosted: number
  }
  proposedAt: string
  acceptedAt?: string
  completedAt?: string
  createdAt: string
}

export interface CreatorMatch {
  creatorId: string
  creatorProfile: CreatorProfile
  stats: CreatorStats
  matchScore: number
  matchReasons: string[]
}

/**
 * Propose a partnership from a venue to a creator.
 */
export function proposePartnership(
  venueId: string,
  venueName: string,
  creatorId: string,
  type: PartnershipType,
  deliverables: PartnershipDeliverables,
  compensation: number
): Partnership {
  const now = new Date().toISOString()
  return {
    id: `partnership-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    venueName,
    creatorId,
    type,
    deliverables,
    compensation,
    status: 'proposed',
    metrics: {
      impressions: 0,
      engagements: 0,
      attributedVisits: 0,
    },
    completedDeliverables: {
      pulsesPosted: 0,
      storiesPosted: 0,
    },
    proposedAt: now,
    createdAt: now,
  }
}

/**
 * Accept a partnership proposal.
 */
export function acceptPartnership(partnership: Partnership): Partnership | null {
  if (partnership.status !== 'proposed') return null
  return {
    ...partnership,
    status: 'active',
    acceptedAt: new Date().toISOString(),
  }
}

/**
 * Decline/cancel a partnership.
 */
export function cancelPartnership(partnership: Partnership): Partnership {
  return {
    ...partnership,
    status: 'cancelled',
  }
}

/**
 * Track deliverables progress for a partnership.
 */
export function trackDeliverables(
  partnership: Partnership,
  type: 'pulse' | 'story'
): Partnership {
  if (partnership.status !== 'active') return partnership

  const updated = { ...partnership }

  if (type === 'pulse') {
    updated.completedDeliverables = {
      ...updated.completedDeliverables,
      pulsesPosted: updated.completedDeliverables.pulsesPosted + 1,
    }
  } else {
    updated.completedDeliverables = {
      ...updated.completedDeliverables,
      storiesPosted: updated.completedDeliverables.storiesPosted + 1,
    }
  }

  return updated
}

/**
 * Update metrics for a partnership.
 */
export function updatePartnershipMetrics(
  partnership: Partnership,
  impressions: number,
  engagements: number,
  attributedVisits: number
): Partnership {
  return {
    ...partnership,
    metrics: {
      impressions: partnership.metrics.impressions + impressions,
      engagements: partnership.metrics.engagements + engagements,
      attributedVisits: partnership.metrics.attributedVisits + attributedVisits,
    },
  }
}

/**
 * Complete a partnership when all deliverables are met.
 */
export function completePartnership(partnership: Partnership): Partnership | null {
  if (partnership.status !== 'active') return null

  const deliverablesMet =
    partnership.completedDeliverables.pulsesPosted >= partnership.deliverables.pulseCount &&
    partnership.completedDeliverables.storiesPosted >= partnership.deliverables.storyCount

  if (!deliverablesMet) return null

  return {
    ...partnership,
    status: 'completed',
    completedAt: new Date().toISOString(),
  }
}

/**
 * Calculate ROI for a partnership.
 * Returns cost per attributed visit.
 */
export function calculatePartnershipROI(partnership: Partnership): {
  costPerVisit: number
  totalVisits: number
  totalImpressions: number
  roi: number
} {
  const visits = partnership.metrics.attributedVisits
  const costPerVisit = visits > 0 ? Math.round((partnership.compensation / visits) * 100) / 100 : 0
  const roi = visits > 0 ? Math.round((visits / partnership.compensation) * 100) : 0

  return {
    costPerVisit,
    totalVisits: visits,
    totalImpressions: partnership.metrics.impressions,
    roi,
  }
}

/**
 * Match venues with available creators based on engagement and reach.
 */
export function getAvailableCreators(
  creators: { profile: CreatorProfile; stats: CreatorStats }[],
  budget: number,
  minEngagementRate: number = 0
): CreatorMatch[] {
  return creators
    .filter(c => {
      if (c.stats.engagementRate < minEngagementRate) return false
      if (c.profile.tier === 'rising' && !['verified', 'elite'].includes(c.profile.tier)) {
        // Rising creators can only do sponsorships if budget is small
        return budget <= 50
      }
      return true
    })
    .map(c => {
      let matchScore = 0
      const matchReasons: string[] = []

      // Engagement rate contributes to score
      matchScore += c.stats.engagementRate * 10
      if (c.stats.engagementRate > 5) {
        matchReasons.push('High engagement rate')
      }

      // Reach
      if (c.stats.reach > 1000) {
        matchScore += 20
        matchReasons.push('High reach')
      }

      // Attributed visits
      if (c.stats.attributedVenueVisits > 10) {
        matchScore += 30
        matchReasons.push('Proven venue driver')
      }

      // Tier bonus
      if (c.profile.tier === 'elite') {
        matchScore += 40
        matchReasons.push('Elite creator')
      } else if (c.profile.tier === 'verified') {
        matchScore += 20
        matchReasons.push('Verified creator')
      }

      return {
        creatorId: c.profile.userId,
        creatorProfile: c.profile,
        stats: c.stats,
        matchScore: Math.round(matchScore),
        matchReasons,
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
}

/**
 * Get partnerships for a creator.
 */
export function getCreatorPartnerships(
  partnerships: Partnership[],
  creatorId: string
): Partnership[] {
  return partnerships.filter(p => p.creatorId === creatorId)
}

/**
 * Get pending proposals for a creator.
 */
export function getCreatorProposals(
  partnerships: Partnership[],
  creatorId: string
): Partnership[] {
  return partnerships.filter(p => p.creatorId === creatorId && p.status === 'proposed')
}

/**
 * Get active partnerships for a creator.
 */
export function getActivePartnerships(
  partnerships: Partnership[],
  creatorId: string
): Partnership[] {
  return partnerships.filter(p => p.creatorId === creatorId && p.status === 'active')
}

/**
 * Create demo partnerships for seed data.
 */
export function createDemoPartnerships(
  venues: { id: string; name: string }[],
  creatorId: string
): Partnership[] {
  if (venues.length < 2) return []

  return [
    proposePartnership(
      venues[0].id,
      venues[0].name,
      creatorId,
      'one-time',
      { pulseCount: 3, storyCount: 1, hashtags: ['#sponsored', `#${venues[0].name.replace(/\s/g, '')}`] },
      75
    ),
    proposePartnership(
      venues[1].id,
      venues[1].name,
      creatorId,
      'recurring',
      { pulseCount: 8, storyCount: 4, hashtags: ['#partner', `#${venues[1].name.replace(/\s/g, '')}`] },
      200
    ),
  ]
}
