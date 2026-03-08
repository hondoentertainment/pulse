import type { Pulse, Venue, EnergyRating } from './types'
import { calculateDistance } from './pulse-engine'

/** Phase 6.3 — Venue Analytics Pro (Revenue) */

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise'

export interface VenueSubscription { venueId: string; tier: SubscriptionTier; startDate: string; endDate: string; active: boolean }
export interface CompetitorBenchmark { venueId: string; venueName: string; score: number; rank: number; nearbyAverage: number; percentile: number }
export interface CustomerFlowEntry { venueId?: string; venueName?: string; count: number; percentage: number }
export interface CustomerFlow { venueId: string; before: CustomerFlowEntry[]; after: CustomerFlowEntry[] }
export interface TimingRecommendation { dayOfWeek: number; hour: number; reason: string; expectedEnergy: EnergyRating; confidence: number }
export interface POSCorrelation { venueId: string; date: string; revenue: number; avgEnergy: number; pulseCount: number; revenuePerPulse: number }

export const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: ['basic_stats'],
  basic: ['basic_stats', 'peak_hours', 'energy_distribution'],
  pro: ['basic_stats', 'peak_hours', 'energy_distribution', 'competitor_benchmark', 'customer_flow', 'timing_recommendations'],
  enterprise: ['basic_stats', 'peak_hours', 'energy_distribution', 'competitor_benchmark', 'customer_flow', 'timing_recommendations', 'pos_correlation', 'api_access', 'export'],
}

export function isFeatureAvailable(subscription: VenueSubscription, feature: string): boolean {
  if (!subscription.active) return false
  return TIER_FEATURES[subscription.tier]?.includes(feature) ?? false
}

export function getCompetitorBenchmarks(target: Venue, allVenues: Venue[], radiusMiles: number = 1): CompetitorBenchmark[] {
  const nearby = allVenues.filter(v => v.id !== target.id && calculateDistance(target.location.lat, target.location.lng, v.location.lat, v.location.lng) <= radiusMiles)
  const all = [target, ...nearby].sort((a, b) => b.pulseScore - a.pulseScore)
  const avgScore = all.length > 0 ? all.reduce((s, v) => s + v.pulseScore, 0) / all.length : 0
  return all.map((v, i) => ({
    venueId: v.id, venueName: v.name, score: v.pulseScore,
    rank: i + 1, nearbyAverage: Math.round(avgScore * 100) / 100,
    percentile: Math.round(((all.length - i) / all.length) * 100),
  }))
}

export function analyzeCustomerFlow(venueId: string, allPulses: Pulse[], windowHours: number = 4): CustomerFlow {
  const windowMs = windowHours * 60 * 60 * 1000
  const byUser = new Map<string, Pulse[]>()
  for (const p of allPulses) { if (!byUser.has(p.userId)) byUser.set(p.userId, []); byUser.get(p.userId)!.push(p) }

  const beforeCounts: Record<string, number> = {}
  const afterCounts: Record<string, number> = {}
  let beforeTotal = 0, afterTotal = 0

  for (const [, userPulses] of byUser) {
    const sorted = userPulses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].venueId !== venueId) continue
      const t = new Date(sorted[i].createdAt).getTime()
      // Look before
      if (i > 0 && sorted[i-1].venueId !== venueId && t - new Date(sorted[i-1].createdAt).getTime() <= windowMs) {
        beforeCounts[sorted[i-1].venueId] = (beforeCounts[sorted[i-1].venueId] ?? 0) + 1; beforeTotal++
      }
      // Look after
      if (i < sorted.length - 1 && sorted[i+1].venueId !== venueId && new Date(sorted[i+1].createdAt).getTime() - t <= windowMs) {
        afterCounts[sorted[i+1].venueId] = (afterCounts[sorted[i+1].venueId] ?? 0) + 1; afterTotal++
      }
    }
  }

  const toEntries = (counts: Record<string, number>, total: number): CustomerFlowEntry[] =>
    Object.entries(counts).sort(([,a],[,b]) => b - a).map(([vid, count]) => ({
      venueId: vid, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))

  return { venueId, before: toEntries(beforeCounts, beforeTotal), after: toEntries(afterCounts, afterTotal) }
}

export function recommendEventTiming(venueId: string, pulses: Pulse[], topN: number = 5): TimingRecommendation[] {
  const venuePulses = pulses.filter(p => p.venueId === venueId)
  const ENERGY_VALUES: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
  const slots: Record<string, { count: number; energy: number }> = {}
  for (const p of venuePulses) {
    const d = new Date(p.createdAt)
    const key = `${d.getDay()}-${d.getHours()}`
    if (!slots[key]) slots[key] = { count: 0, energy: 0 }
    slots[key].count++; slots[key].energy += ENERGY_VALUES[p.energyRating]
  }
  // Find low-activity but nearby high-activity slots (opportunity gaps)
  const allSlots = Object.entries(slots).map(([k, v]) => ({ key: k, ...v, avgEnergy: v.count > 0 ? v.energy / v.count : 0 }))
  const recs: TimingRecommendation[] = []
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 17; h <= 23; h++) {
      const key = `${dow}-${h}`
      const slot = allSlots.find(s => s.key === key)
      const adjacentHigh = allSlots.some(s => {
        const [sd, sh] = s.key.split('-').map(Number)
        return sd === dow && Math.abs(sh - h) <= 2 && s.avgEnergy >= 2
      })
      if ((!slot || slot.count <= 1) && adjacentHigh) {
        recs.push({
          dayOfWeek: dow, hour: h, reason: 'Low activity near high-energy hours',
          expectedEnergy: 'buzzing', confidence: 0.6,
        })
      }
    }
  }
  return recs.sort((a, b) => b.confidence - a.confidence).slice(0, topN)
}

export function calculatePOSCorrelation(venueId: string, pulses: Pulse[], revenueData: { date: string; revenue: number }[]): POSCorrelation[] {
  const ENERGY_VALUES: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
  const venuePulses = pulses.filter(p => p.venueId === venueId)
  return revenueData.map(rd => {
    const dayPulses = venuePulses.filter(p => p.createdAt.startsWith(rd.date))
    const avgE = dayPulses.length > 0 ? dayPulses.reduce((s, p) => s + ENERGY_VALUES[p.energyRating], 0) / dayPulses.length : 0
    return {
      venueId, date: rd.date, revenue: rd.revenue,
      avgEnergy: Math.round(avgE * 100) / 100, pulseCount: dayPulses.length,
      revenuePerPulse: dayPulses.length > 0 ? Math.round((rd.revenue / dayPulses.length) * 100) / 100 : 0,
    }
  })
}
