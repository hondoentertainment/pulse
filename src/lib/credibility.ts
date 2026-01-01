import { User, Pulse } from './types'

export interface TrustBadge {
  id: string
  label: string
  icon: string
  color: string
  description: string
}

export function calculateUserCredibility(
  user: User,
  allPulses: Pulse[]
): number {
  const userPulses = allPulses.filter((p) => p.userId === user.id)
  const accountAgeMs = Date.now() - new Date(user.createdAt).getTime()
  const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24)

  let credibilityScore = 1.0

  if (accountAgeDays < 1) {
    credibilityScore = 0.5
  } else if (accountAgeDays < 7) {
    credibilityScore = 0.7
  } else if (accountAgeDays < 30) {
    credibilityScore = 0.9
  }

  const totalPulses = userPulses.length
  if (totalPulses >= 50) {
    credibilityScore += 0.3
  } else if (totalPulses >= 20) {
    credibilityScore += 0.2
  } else if (totalPulses >= 10) {
    credibilityScore += 0.1
  }

  const avgEngagement = userPulses.reduce((acc, p) => {
    return acc + p.reactions.fire + p.reactions.lightning + p.reactions.eyes + p.reactions.skull
  }, 0) / Math.max(totalPulses, 1)

  if (avgEngagement >= 10) {
    credibilityScore += 0.2
  } else if (avgEngagement >= 5) {
    credibilityScore += 0.1
  }

  return Math.min(2.0, credibilityScore)
}

export function getUserTrustBadges(
  user: User,
  venueId: string,
  allPulses: Pulse[]
): TrustBadge[] {
  const badges: TrustBadge[] = []
  const userPulses = allPulses.filter((p) => p.userId === user.id)
  const venuePulses = userPulses.filter((p) => p.venueId === venueId)
  const venueCheckIns = user.venueCheckInHistory?.[venueId] || 0

  if (venueCheckIns >= 10 || venuePulses.length >= 10) {
    badges.push({
      id: 'regular',
      label: 'Regular here',
      icon: '⭐',
      color: 'oklch(0.75 0.18 195)',
      description: `${venueCheckIns} check-ins at this venue`
    })
  } else if (venueCheckIns >= 5 || venuePulses.length >= 5) {
    badges.push({
      id: 'frequent',
      label: 'Frequent visitor',
      icon: '✨',
      color: 'oklch(0.70 0.22 60)',
      description: `${venueCheckIns} check-ins at this venue`
    })
  }

  const accountAgeMs = Date.now() - new Date(user.createdAt).getTime()
  const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24)

  if (accountAgeDays >= 90 && userPulses.length >= 20) {
    badges.push({
      id: 'veteran',
      label: 'Veteran',
      icon: '🏆',
      color: 'oklch(0.75 0.18 195)',
      description: 'Long-time Pulse user'
    })
  }

  const last24Hours = Date.now() - 24 * 60 * 60 * 1000
  const recentVenuePulses = venuePulses.filter(
    (p) => new Date(p.createdAt).getTime() > last24Hours
  )

  if (recentVenuePulses.length >= 2) {
    badges.push({
      id: 'active-tonight',
      label: `${recentVenuePulses.length} pulses tonight`,
      icon: '🔥',
      color: 'oklch(0.65 0.28 340)',
      description: 'Very active at this venue tonight'
    })
  } else if (recentVenuePulses.length === 1 && venuePulses.length > 1) {
    const pulseIndex = venuePulses.findIndex((p) => p.id === recentVenuePulses[0].id)
    const totalVenuePulses = venuePulses.length
    badges.push({
      id: 'return-visit',
      label: `${getOrdinal(pulseIndex + 1)} pulse here`,
      icon: '📍',
      color: 'oklch(0.70 0.22 60)',
      description: `${totalVenuePulses} total pulses at this venue`
    })
  }

  const avgEngagement = userPulses.reduce((acc, p) => {
    return acc + p.reactions.fire + p.reactions.lightning + p.reactions.eyes + p.reactions.skull
  }, 0) / Math.max(userPulses.length, 1)

  if (avgEngagement >= 10 && userPulses.length >= 10) {
    badges.push({
      id: 'trusted',
      label: 'Trusted source',
      icon: '✓',
      color: 'oklch(0.60 0.15 150)',
      description: 'Consistently engaging pulses'
    })
  }

  return badges.slice(0, 2)
}

export function getPulseCredibilityWeight(
  pulse: Pulse,
  user: User,
  allPulses: Pulse[]
): number {
  if (pulse.credibilityWeight !== undefined) {
    return pulse.credibilityWeight
  }

  const credibility = calculateUserCredibility(user, allPulses)
  return credibility
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
