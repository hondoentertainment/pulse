import type { Venue } from './types'

/** Phase 6.4 — Promoted Discoveries (Revenue) */

export type PricingModel = 'cpc' | 'cpp' | 'cpm' | 'flat'

export interface PromotedVenue {
  id: string; venueId: string; campaignName: string; startDate: string; endDate: string
  budget: number; spent: number; pricingModel: PricingModel; pricePerUnit: number
  impressions: number; clicks: number; conversions: number; active: boolean; label: 'Sponsored'
}

export interface PromotedEvent {
  id: string; eventId: string; venueId: string; budget: number; spent: number
  pricingModel: PricingModel; pricePerUnit: number; impressions: number; clicks: number; active: boolean
}

export interface VenueBoost {
  id: string; venueId: string; boostMultiplier: number; startTime: string; endTime: string
  budget: number; spent: number; active: boolean
}

export interface CampaignMetrics {
  impressions: number; clicks: number; conversions: number
  ctr: number; conversionRate: number; costPerConversion: number
  spent: number; remaining: number
}

export function createPromotedVenue(venueId: string, campaignName: string, budget: number, pricingModel: PricingModel, pricePerUnit: number, durationDays: number): PromotedVenue {
  const now = new Date()
  return {
    id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId, campaignName, budget, spent: 0, pricingModel, pricePerUnit,
    startDate: now.toISOString(), endDate: new Date(now.getTime() + durationDays * 86400000).toISOString(),
    impressions: 0, clicks: 0, conversions: 0, active: true, label: 'Sponsored',
  }
}

export function createPromotedEvent(eventId: string, venueId: string, budget: number, pricingModel: PricingModel, pricePerUnit: number): PromotedEvent {
  return { id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, eventId, venueId, budget, spent: 0, pricingModel, pricePerUnit, impressions: 0, clicks: 0, active: true }
}

export function createVenueBoost(venueId: string, boostMultiplier: number, durationHours: number, budget: number): VenueBoost {
  const now = new Date()
  return { id: `boost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, venueId, boostMultiplier, startTime: now.toISOString(), endTime: new Date(now.getTime() + durationHours * 3600000).toISOString(), budget, spent: 0, active: true }
}

export function recordImpression<T extends { impressions: number; spent: number; budget: number; pricingModel: PricingModel; pricePerUnit: number }>(promo: T): T {
  const cost = promo.pricingModel === 'cpm' ? promo.pricePerUnit / 1000 : 0
  return { ...promo, impressions: promo.impressions + 1, spent: Math.round((promo.spent + cost) * 100) / 100 }
}

export function recordClick<T extends { clicks: number; spent: number; budget: number; pricingModel: PricingModel; pricePerUnit: number }>(promo: T): T {
  const cost = promo.pricingModel === 'cpc' ? promo.pricePerUnit : 0
  return { ...promo, clicks: promo.clicks + 1, spent: Math.round((promo.spent + cost) * 100) / 100 }
}

export function recordConversion(promo: PromotedVenue): PromotedVenue {
  const cost = promo.pricingModel === 'cpp' ? promo.pricePerUnit : 0
  return { ...promo, conversions: promo.conversions + 1, spent: Math.round((promo.spent + cost) * 100) / 100 }
}

export function getCampaignMetrics(promo: PromotedVenue): CampaignMetrics {
  return {
    impressions: promo.impressions, clicks: promo.clicks, conversions: promo.conversions,
    ctr: promo.impressions > 0 ? Math.round((promo.clicks / promo.impressions) * 10000) / 100 : 0,
    conversionRate: promo.clicks > 0 ? Math.round((promo.conversions / promo.clicks) * 10000) / 100 : 0,
    costPerConversion: promo.conversions > 0 ? Math.round((promo.spent / promo.conversions) * 100) / 100 : 0,
    spent: promo.spent, remaining: Math.round((promo.budget - promo.spent) * 100) / 100,
  }
}

export function isPromotionActive(promo: { active: boolean; budget: number; spent: number; endDate?: string; endTime?: string }): boolean {
  if (!promo.active) return false
  if (promo.spent >= promo.budget) return false
  const end = promo.endDate ?? promo.endTime
  if (end && new Date(end).getTime() < Date.now()) return false
  return true
}

export function getActivePromotions<T extends { active: boolean; budget: number; spent: number; endDate?: string; endTime?: string }>(promos: T[]): T[] {
  return promos.filter(isPromotionActive)
}

export function applyBoostToScore(baseScore: number, boosts: VenueBoost[]): number {
  const activeBoosts = boosts.filter(b => isPromotionActive({ ...b, endDate: b.endTime }))
  if (activeBoosts.length === 0) return baseScore
  const maxMultiplier = Math.max(...activeBoosts.map(b => b.boostMultiplier))
  return Math.min(100, Math.round(baseScore * maxMultiplier))
}

export function sortWithPromotions(venues: Venue[], promotedVenueIds: Set<string>): Venue[] {
  const promoted = venues.filter(v => promotedVenueIds.has(v.id))
  const organic = venues.filter(v => !promotedVenueIds.has(v.id))
  const result = [...organic]
  // Insert promoted at positions 1 and 4 (0-indexed)
  if (promoted[0] && result.length >= 1) result.splice(1, 0, promoted[0])
  if (promoted[1] && result.length >= 4) result.splice(4, 0, promoted[1])
  else if (promoted[1]) result.push(promoted[1])
  // Append remaining promoted
  for (let i = 2; i < promoted.length; i++) result.push(promoted[i])
  return result
}
