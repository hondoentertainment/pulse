import type { Pulse, Venue, EnergyRating } from './types'
import { analyzeVenuePatterns, predictSurge } from './predictive-surge'

/**
 * Venue Operator Platform Engine (B2B SaaS)
 *
 * Plan tiers, competitor benchmarking, guest CRM,
 * staff scheduling insights, social content generation,
 * and revenue dashboard.
 */

// ─── Plan & Account ─────────────────────────────────────────────

export type PlanTier = 'free' | 'pro' | 'enterprise'

export interface VenuePlatformAccount {
  venueId: string
  plan: PlanTier
  billingCycle: 'monthly' | 'annual'
  features: string[]
  teamMembers: TeamMember[]
  competitorVenues: string[]
}

export interface TeamMember {
  userId: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
  addedAt: string
  lastActiveAt?: string
}

export const PLAN_CONFIG: Record<PlanTier, {
  name: string
  price: number
  maxTeamMembers: number
  features: string[]
  description: string
}> = {
  free: {
    name: 'Free',
    price: 0,
    maxTeamMembers: 1,
    features: ['basic_analytics', 'respond_to_pulses'],
    description: 'Basic analytics and pulse responses',
  },
  pro: {
    name: 'Pro',
    price: 99,
    maxTeamMembers: 5,
    features: [
      'basic_analytics', 'respond_to_pulses', 'full_analytics',
      'competitor_benchmarking', 'promotional_campaigns', 'crm',
      'staff_insights',
    ],
    description: 'Full analytics, competitor benchmarking, CRM, and promotional campaigns',
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,
    maxTeamMembers: 50,
    features: [
      'basic_analytics', 'respond_to_pulses', 'full_analytics',
      'competitor_benchmarking', 'promotional_campaigns', 'crm',
      'staff_insights', 'api_access', 'multi_venue', 'white_label',
      'priority_support',
    ],
    description: 'All Pro features plus API access, multi-venue management, and white-label',
  },
}

export function createPlatformAccount(
  venueId: string,
  ownerUserId: string,
  ownerName: string,
  ownerEmail: string,
  plan: PlanTier = 'free'
): VenuePlatformAccount {
  return {
    venueId,
    plan,
    billingCycle: 'monthly',
    features: PLAN_CONFIG[plan].features,
    teamMembers: [{
      userId: ownerUserId,
      name: ownerName,
      email: ownerEmail,
      role: 'owner',
      addedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }],
    competitorVenues: [],
  }
}

export function isPlanFeatureAvailable(plan: PlanTier, feature: string): boolean {
  return PLAN_CONFIG[plan].features.includes(feature)
}

export function addTeamMember(
  account: VenuePlatformAccount,
  userId: string,
  name: string,
  email: string,
  role: 'manager' | 'staff'
): VenuePlatformAccount {
  const max = PLAN_CONFIG[account.plan].maxTeamMembers
  if (account.teamMembers.length >= max) {
    return account
  }
  return {
    ...account,
    teamMembers: [
      ...account.teamMembers,
      { userId, name, email, role, addedAt: new Date().toISOString() },
    ],
  }
}

export function removeTeamMember(
  account: VenuePlatformAccount,
  userId: string
): VenuePlatformAccount {
  return {
    ...account,
    teamMembers: account.teamMembers.filter(m => m.userId !== userId && m.role !== 'owner'),
  }
}

// ─── Competitor Benchmarking ────────────────────────────────────

export interface CompetitorBenchmarkResult {
  venueId: string
  venueName: string
  pulseScore: number
  trendingFrequency: number
  visitorCount: number
  avgEnergy: number
  peakHour: number
}

export interface BenchmarkComparison {
  yourVenue: CompetitorBenchmarkResult
  competitors: CompetitorBenchmarkResult[]
  insights: string[]
}

export function getCompetitorBenchmark(
  venueId: string,
  competitorIds: string[],
  venues: Venue[],
  pulses: Pulse[]
): BenchmarkComparison {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const weekAgo = now - 7 * day

  function buildResult(vid: string): CompetitorBenchmarkResult {
    const venue = venues.find(v => v.id === vid)
    const vPulses = pulses.filter(p => p.venueId === vid && new Date(p.createdAt).getTime() > weekAgo)
    const energyValues: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }

    const avgEnergy = vPulses.length > 0
      ? vPulses.reduce((s, p) => s + energyValues[p.energyRating], 0) / vPulses.length
      : 0

    const hourCounts: Record<number, number> = {}
    for (const p of vPulses) {
      const h = new Date(p.createdAt).getHours()
      hourCounts[h] = (hourCounts[h] ?? 0) + 1
    }
    const peakHour = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0]

    const trendingDays = new Set(
      vPulses.filter(p => {
        const e = energyValues[p.energyRating]
        return e >= 2
      }).map(p => new Date(p.createdAt).toDateString())
    ).size

    return {
      venueId: vid,
      venueName: venue?.name ?? vid,
      pulseScore: venue?.pulseScore ?? 0,
      trendingFrequency: trendingDays,
      visitorCount: new Set(vPulses.map(p => p.userId)).size,
      avgEnergy: Math.round(avgEnergy * 100) / 100,
      peakHour: Number(peakHour) || 21,
    }
  }

  const yourVenue = buildResult(venueId)
  const competitors = competitorIds.map(buildResult)

  const insights: string[] = []
  for (const comp of competitors) {
    if (yourVenue.pulseScore > comp.pulseScore) {
      insights.push(`You're beating ${comp.venueName} on pulse score`)
    }
    if (yourVenue.visitorCount > comp.visitorCount) {
      insights.push(`You're beating ${comp.venueName} on visitor count`)
    }
    if (yourVenue.avgEnergy > comp.avgEnergy) {
      insights.push(`You're beating ${comp.venueName} on energy`)
    }
    if (yourVenue.trendingFrequency > comp.trendingFrequency) {
      insights.push(`You're beating ${comp.venueName} on trending frequency`)
    }
    if (comp.pulseScore > yourVenue.pulseScore) {
      insights.push(`${comp.venueName} has a higher pulse score — consider boosting promotions`)
    }
  }

  return { yourVenue, competitors, insights }
}

// ─── Guest CRM ──────────────────────────────────────────────────

export interface GuestProfile {
  userId: string
  username: string
  visits: { date: string; energyRating: EnergyRating }[]
  totalSpend: number
  averageSpend: number
  firstVisit: string
  lastVisit: string
  favoriteNights: string[]
  tags: string[]
  isVIP: boolean
  notes: string
}

export function buildGuestProfiles(venueId: string, pulses: Pulse[], users: { id: string; username: string }[]): GuestProfile[] {
  const venuePulses = pulses.filter(p => p.venueId === venueId)
  const byUser = new Map<string, Pulse[]>()

  for (const p of venuePulses) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, [])
    byUser.get(p.userId)!.push(p)
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const profiles: GuestProfile[] = []

  for (const [userId, userPulses] of byUser) {
    const sorted = userPulses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const user = users.find(u => u.id === userId)

    const dayCounts: Record<string, number> = {}
    for (const p of sorted) {
      const day = days[new Date(p.createdAt).getDay()]
      dayCounts[day] = (dayCounts[day] ?? 0) + 1
    }
    const favoriteNights = Object.entries(dayCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([d]) => d)

    // Simulate spend based on visit count and energy
    const energySpend: Record<EnergyRating, number> = { dead: 15, chill: 25, buzzing: 40, electric: 55 }
    const totalSpend = sorted.reduce((s, p) => s + energySpend[p.energyRating], 0)

    profiles.push({
      userId,
      username: user?.username ?? userId,
      visits: sorted.map(p => ({ date: p.createdAt, energyRating: p.energyRating })),
      totalSpend,
      averageSpend: sorted.length > 0 ? Math.round(totalSpend / sorted.length) : 0,
      firstVisit: sorted[0]?.createdAt ?? '',
      lastVisit: sorted[sorted.length - 1]?.createdAt ?? '',
      favoriteNights,
      tags: sorted.length >= 10 ? ['VIP'] : sorted.length >= 5 ? ['Regular'] : ['New'],
      isVIP: sorted.length >= 10,
      notes: '',
    })
  }

  return profiles.sort((a, b) => b.visits.length - a.visits.length)
}

export function getRegulars(profiles: GuestProfile[]): GuestProfile[] {
  return profiles.filter(p => p.visits.length >= 5)
}

export function getVIPGuests(profiles: GuestProfile[]): GuestProfile[] {
  return profiles.filter(p => p.isVIP)
}

export function getChurningGuests(profiles: GuestProfile[], daysSinceLastVisit: number = 30): GuestProfile[] {
  const cutoff = Date.now() - daysSinceLastVisit * 24 * 60 * 60 * 1000
  return profiles.filter(p => {
    if (!p.lastVisit) return false
    return new Date(p.lastVisit).getTime() < cutoff && p.visits.length >= 2
  })
}

export function getNewGuests(profiles: GuestProfile[], withinDays: number = 30): GuestProfile[] {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000
  return profiles.filter(p => {
    if (!p.firstVisit) return false
    return new Date(p.firstVisit).getTime() > cutoff
  })
}

export function addGuestTag(profile: GuestProfile, tag: string): GuestProfile {
  if (profile.tags.includes(tag)) return profile
  return { ...profile, tags: [...profile.tags, tag] }
}

export function addGuestNote(profile: GuestProfile, note: string): GuestProfile {
  return { ...profile, notes: note }
}

// ─── Staff Scheduling Insights ──────────────────────────────────

export type StaffingLevel = 'light' | 'moderate' | 'heavy'

export interface HourlyStaffRecommendation {
  hour: number
  level: StaffingLevel
  recommendedStaff: number
  predictedVisitors: number
  confidence: number
}

export interface StaffSchedule {
  date: string
  dayOfWeek: number
  hours: HourlyStaffRecommendation[]
}

export function getStaffingRecommendation(
  venueId: string,
  date: Date,
  pulses: Pulse[]
): StaffSchedule {
  const dayOfWeek = date.getDay()
  const patterns = analyzeVenuePatterns(venueId, pulses, 60)
  const dayPattern = patterns.find(p => p.dayOfWeek === dayOfWeek)

  const hours: HourlyStaffRecommendation[] = []

  for (let h = 10; h <= 26; h++) {
    const hour = h > 23 ? h - 24 : h
    const dist = dayPattern?.hourDistribution[hour]
    const avgPulses = dist?.avgPulseCount ?? 0
    const avgEnergy = dist?.avgEnergy ?? 0

    // Use actual pulse count as activity indicator (no inflated multiplier)
    const predictedVisitors = Math.round(avgPulses)

    let level: StaffingLevel = 'light'
    let recommendedStaff = 2

    if (predictedVisitors > 40 || avgEnergy > 2) {
      level = 'heavy'
      recommendedStaff = Math.max(5, Math.ceil(predictedVisitors / 10))
    } else if (predictedVisitors > 15 || avgEnergy > 1) {
      level = 'moderate'
      recommendedStaff = Math.max(3, Math.ceil(predictedVisitors / 15))
    }

    const confidence = dayPattern ? Math.min(0.9, avgPulses / 5) : 0.1

    hours.push({
      hour,
      level,
      recommendedStaff,
      predictedVisitors,
      confidence: Math.round(confidence * 100) / 100,
    })
  }

  return {
    date: date.toISOString().split('T')[0],
    dayOfWeek,
    hours,
  }
}

// ─── Automated Social Content ───────────────────────────────────

export interface SocialContent {
  id: string
  type: 'highlight' | 'event' | 'milestone'
  text: string
  hashtags: string[]
  createdAt: string
}

export function generateSocialPost(
  venueId: string,
  type: 'highlight' | 'event' | 'milestone',
  venue: Venue,
  pulses: Pulse[]
): SocialContent {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const recentPulses = pulses.filter(
    p => p.venueId === venueId && now - new Date(p.createdAt).getTime() < day
  )

  const energyValues: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
  const avgEnergy = recentPulses.length > 0
    ? recentPulses.reduce((s, p) => s + energyValues[p.energyRating], 0) / recentPulses.length
    : 0

  const allTags: string[] = []
  for (const p of recentPulses) {
    for (const t of p.hashtags ?? []) {
      if (!allTags.includes(t)) allTags.push(t)
    }
  }

  let text = ''
  const hashtags = [`#${venue.name.replace(/\s+/g, '')}`, '#NightOut', '#Pulse']

  if (type === 'highlight') {
    if (avgEnergy >= 2.5) {
      text = `The energy at ${venue.name} is absolutely ELECTRIC tonight! Come through!`
    } else if (avgEnergy >= 1.5) {
      text = `${venue.name} is buzzing right now. Don't miss out!`
    } else {
      text = `Chill vibes at ${venue.name} tonight. Perfect spot to kick back and relax.`
    }
  } else if (type === 'event') {
    text = `Something special is happening at ${venue.name}! Check the Pulse app for the latest vibes and updates.`
  } else if (type === 'milestone') {
    const totalVisitors = new Set(pulses.filter(p => p.venueId === venueId).map(p => p.userId)).size
    text = `${venue.name} just hit ${totalVisitors} unique visitors on Pulse! Thank you for making us your spot!`
  }

  if (allTags.length > 0) {
    hashtags.push(...allTags.slice(0, 3).map(t => t.startsWith('#') ? t : `#${t}`))
  }

  return {
    id: `social-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    text,
    hashtags: [...new Set(hashtags)],
    createdAt: new Date().toISOString(),
  }
}

// ─── Revenue Dashboard ──────────────────────────────────────────

export interface RevenueMetrics {
  venueId: string
  period: string
  estimatedTicketRevenue: number
  estimatedTableRevenue: number
  estimatedTotalRevenue: number
  promoSpend: number
  promoROI: number
  revenuePerVisitor: number
  topRevenueNight: string
  revenueByDay: { day: string; revenue: number }[]
}

export function getRevenueMetrics(
  venueId: string,
  period: '7d' | '30d' | '90d',
  pulses: Pulse[]
): RevenueMetrics {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const cutoff = now - periodDays * day

  const periodPulses = pulses.filter(
    p => p.venueId === venueId && new Date(p.createdAt).getTime() > cutoff
  )

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const energySpend: Record<EnergyRating, number> = { dead: 15, chill: 30, buzzing: 50, electric: 75 }

  // Estimate revenue based on energy levels (higher energy = more spend)
  // Use actual unique pulse users — no inflated multiplier
  const estimatedVisitors = new Set(periodPulses.map(p => p.userId)).size

  const dayRevenue: Record<string, number> = {}
  for (const p of periodPulses) {
    const d = days[new Date(p.createdAt).getDay()]
    dayRevenue[d] = (dayRevenue[d] ?? 0) + energySpend[p.energyRating]
  }

  const totalRevenue = Object.values(dayRevenue).reduce((s, v) => s + v, 0)
  const ticketRevenue = Math.round(totalRevenue * 0.35)
  const tableRevenue = Math.round(totalRevenue * 0.25)

  const topDay = Object.entries(dayRevenue).sort(([, a], [, b]) => b - a)[0]
  const promoSpend = periodDays * 5 // estimated $5/day baseline
  const promoROI = promoSpend > 0 ? Math.round((totalRevenue / promoSpend) * 100) / 100 : 0

  return {
    venueId,
    period,
    estimatedTicketRevenue: ticketRevenue,
    estimatedTableRevenue: tableRevenue,
    estimatedTotalRevenue: totalRevenue,
    promoSpend,
    promoROI,
    revenuePerVisitor: estimatedVisitors > 0 ? Math.round(totalRevenue / estimatedVisitors) : 0,
    topRevenueNight: topDay?.[0] ?? 'Saturday',
    revenueByDay: days.map(d => ({ day: d, revenue: dayRevenue[d] ?? 0 })),
  }
}

// ─── Campaign Management ────────────────────────────────────────

export interface Campaign {
  id: string
  venueId: string
  name: string
  type: 'promoted_listing' | 'happy_hour' | 'event_boost' | 'brand_awareness'
  status: 'draft' | 'active' | 'paused' | 'completed'
  budget: number
  spent: number
  impressions: number
  clicks: number
  conversions: number
  startDate: string
  endDate: string
  createdAt: string
}

export function createCampaign(
  venueId: string,
  name: string,
  type: Campaign['type'],
  budget: number,
  startDate: string,
  endDate: string
): Campaign {
  return {
    id: `camp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    name,
    type,
    status: 'draft',
    budget,
    spent: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    startDate,
    endDate,
    createdAt: new Date().toISOString(),
  }
}

export function getCampaignROI(campaign: Campaign): number {
  if (campaign.spent === 0) return 0
  // Estimated revenue per conversion
  const revenuePerConversion = 45
  return Math.round((campaign.conversions * revenuePerConversion / campaign.spent) * 100) / 100
}

export function getCampaignCTR(campaign: Campaign): number {
  if (campaign.impressions === 0) return 0
  return Math.round((campaign.clicks / campaign.impressions) * 10000) / 100
}
