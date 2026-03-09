import type { Venue, Pulse } from './types'
import { createHmac } from 'crypto'

/** Phase 7.1 — Public API & Developer Platform */

export interface APIKey {
  id: string; key: string; name: string; ownerId: string
  tier: 'free' | 'starter' | 'business' | 'enterprise'
  createdAt: string; lastUsedAt?: string; active: boolean
  rateLimit: number; dailyRequests: number; dailyLimit: number
}

export type WebhookEventType = 'venue.surge' | 'venue.score_change' | 'venue.new_pulse' | 'neighborhood.hottest'

export interface WebhookSubscription {
  id: string; apiKeyId: string; url: string; events: WebhookEventType[]
  secret: string; active: boolean; createdAt: string
  lastTriggeredAt?: string; failureCount: number
}

export interface WebhookPayload { event: string; timestamp: number; data: Record<string, unknown>; signature: string }

export interface APIEndpoint { method: string; path: string; description: string; tier: string; rateLimit: number }

export const TIER_LIMITS: Record<string, { rateLimit: number; daily: number }> = {
  free: { rateLimit: 60, daily: 1000 },
  starter: { rateLimit: 300, daily: 10000 },
  business: { rateLimit: 1000, daily: 100000 },
  enterprise: { rateLimit: 5000, daily: 1000000 },
}

export const API_ENDPOINTS: APIEndpoint[] = [
  { method: 'GET', path: '/venues', description: 'List venues', tier: 'free', rateLimit: 60 },
  { method: 'GET', path: '/venues/:id', description: 'Get venue details', tier: 'free', rateLimit: 60 },
  { method: 'GET', path: '/venues/:id/pulses', description: 'Get venue pulses', tier: 'starter', rateLimit: 30 },
  { method: 'GET', path: '/venues/:id/score', description: 'Get venue energy score', tier: 'free', rateLimit: 120 },
  { method: 'GET', path: '/neighborhoods', description: 'List neighborhoods', tier: 'starter', rateLimit: 60 },
  { method: 'GET', path: '/neighborhoods/:id', description: 'Get neighborhood details', tier: 'starter', rateLimit: 60 },
  { method: 'GET', path: '/cities/:city/trending', description: 'Get city trending venues', tier: 'free', rateLimit: 30 },
  { method: 'POST', path: '/webhooks', description: 'Create webhook subscription', tier: 'business', rateLimit: 10 },
  { method: 'GET', path: '/analytics/venue/:id', description: 'Get venue analytics', tier: 'business', rateLimit: 30 },
]

const TIER_ORDER = ['free', 'starter', 'business', 'enterprise']

export function generateAPIKey(name: string, ownerId: string, tier: APIKey['tier'] = 'free'): APIKey {
  const limits = TIER_LIMITS[tier]
  return {
    id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key: `pk_${tier}_${randomHex(32)}`,
    name, ownerId, tier, createdAt: new Date().toISOString(), active: true,
    rateLimit: limits.rateLimit, dailyRequests: 0, dailyLimit: limits.daily,
  }
}

export function validateAPIKey(key: string, keys: APIKey[]): { valid: boolean; apiKey?: APIKey; error?: string } {
  const found = keys.find(k => k.key === key)
  if (!found) return { valid: false, error: 'Invalid API key' }
  if (!found.active) return { valid: false, error: 'API key is inactive' }
  return { valid: true, apiKey: found }
}

export function checkAPIRateLimit(apiKey: APIKey): { allowed: boolean; remaining: number; resetAt: string } {
  const remaining = apiKey.dailyLimit - apiKey.dailyRequests
  const tomorrow = new Date()
  tomorrow.setHours(24, 0, 0, 0)
  return { allowed: remaining > 0, remaining: Math.max(0, remaining), resetAt: tomorrow.toISOString() }
}

export function incrementDailyUsage(apiKey: APIKey): APIKey {
  return { ...apiKey, dailyRequests: apiKey.dailyRequests + 1, lastUsedAt: new Date().toISOString() }
}

export function createWebhookSubscription(apiKeyId: string, url: string, events: WebhookEventType[], secret: string): WebhookSubscription {
  return {
    id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    apiKeyId, url, events, secret, active: true,
    createdAt: new Date().toISOString(), failureCount: 0,
  }
}

export function generateWebhookPayload(event: string, data: Record<string, unknown>, secret: string): WebhookPayload {
  const timestamp = Date.now()
  const body = JSON.stringify({ event, timestamp, data })
  const signature = createHmac('sha256', secret).update(body).digest('hex')
  return { event, timestamp, data, signature }
}

export function verifyWebhookSignature(payload: WebhookPayload, secret: string): boolean {
  const body = JSON.stringify({ event: payload.event, timestamp: payload.timestamp, data: payload.data })
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return expected === payload.signature
}

export function getEndpointsForTier(tier: APIKey['tier']): APIEndpoint[] {
  const tierIdx = TIER_ORDER.indexOf(tier)
  return API_ENDPOINTS.filter(ep => TIER_ORDER.indexOf(ep.tier) <= tierIdx)
}

export function formatVenueResponse(venue: Venue, pulses?: Pulse[]): Record<string, unknown> {
  const resp: Record<string, unknown> = {
    id: venue.id, name: venue.name, category: venue.category ?? null,
    city: venue.city ?? null, state: venue.state ?? null,
    location: { lat: venue.location.lat, lng: venue.location.lng },
    pulseScore: venue.pulseScore, lastPulseAt: venue.lastPulseAt ?? null,
  }
  if (pulses) {
    resp.recentPulses = pulses.slice(0, 10).map(p => ({
      id: p.id, energyRating: p.energyRating, createdAt: p.createdAt,
      caption: p.caption ?? null, photoCount: p.photos.length,
    }))
  }
  return resp
}

function randomHex(len: number): string {
  const chars = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)]
  return s
}
