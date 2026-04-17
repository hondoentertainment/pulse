import { describe, it, expect } from 'vitest'
import {
  generateAPIKey,
  validateAPIKey,
  checkAPIRateLimit,
  incrementDailyUsage,
  createWebhookSubscription,
  generateWebhookPayload,
  verifyWebhookSignature,
  getEndpointsForTier,
  formatVenueResponse,
  TIER_LIMITS,
  API_ENDPOINTS,
} from '../public-api'
import type { Venue, Pulse } from '../types'

describe('generateAPIKey', () => {
  it('generates a key with correct tier', () => {
    const key = generateAPIKey('My App', 'u1', 'starter')
    expect(key.tier).toBe('starter')
    expect(key.key).toContain('pk_starter_')
    expect(key.active).toBe(true)
    expect(key.dailyLimit).toBe(TIER_LIMITS.starter.daily)
  })

  it('defaults to free tier', () => {
    const key = generateAPIKey('Test', 'u1')
    expect(key.tier).toBe('free')
    expect(key.dailyLimit).toBe(1000)
  })
})

describe('validateAPIKey', () => {
  it('validates a valid key', () => {
    const key = generateAPIKey('Test', 'u1')
    const result = validateAPIKey(key.key, [key])
    expect(result.valid).toBe(true)
    expect(result.apiKey).toBeDefined()
  })

  it('rejects invalid key', () => {
    const result = validateAPIKey('invalid', [])
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid API key')
  })

  it('rejects inactive key', () => {
    const key = { ...generateAPIKey('Test', 'u1'), active: false }
    const result = validateAPIKey(key.key, [key])
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key is inactive')
  })
})

describe('checkAPIRateLimit', () => {
  it('allows when under limit', () => {
    const key = generateAPIKey('Test', 'u1')
    const result = checkAPIRateLimit(key)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1000)
  })

  it('denies when at limit', () => {
    const key = { ...generateAPIKey('Test', 'u1'), dailyRequests: 1000 }
    const result = checkAPIRateLimit(key)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})

describe('incrementDailyUsage', () => {
  it('increments count', () => {
    const key = generateAPIKey('Test', 'u1')
    const updated = incrementDailyUsage(key)
    expect(updated.dailyRequests).toBe(1)
    expect(updated.lastUsedAt).toBeDefined()
  })
})

describe('createWebhookSubscription', () => {
  it('creates a subscription', () => {
    const wh = createWebhookSubscription('key-1', 'https://example.com/hook', ['venue.surge'], 'secret123')
    expect(wh.apiKeyId).toBe('key-1')
    expect(wh.events).toContain('venue.surge')
    expect(wh.active).toBe(true)
    expect(wh.failureCount).toBe(0)
  })
})

describe('webhook signatures', () => {
  it('generates and verifies signature', () => {
    const secret = 'test-secret-key'
    const payload = generateWebhookPayload('venue.surge', { venueId: 'v1' }, secret)
    expect(payload.signature).toBeDefined()
    expect(verifyWebhookSignature(payload, secret)).toBe(true)
  })

  it('fails verification with wrong secret', () => {
    const payload = generateWebhookPayload('venue.surge', { venueId: 'v1' }, 'correct-secret')
    expect(verifyWebhookSignature(payload, 'wrong-secret')).toBe(false)
  })
})

describe('getEndpointsForTier', () => {
  it('free tier gets free endpoints', () => {
    const eps = getEndpointsForTier('free')
    expect(eps.every(e => e.tier === 'free')).toBe(true)
  })

  it('business tier gets free + starter + business', () => {
    const eps = getEndpointsForTier('business')
    const freeCount = API_ENDPOINTS.filter(e => e.tier === 'free').length
    expect(eps.length).toBeGreaterThan(freeCount)
  })

  it('enterprise gets all endpoints', () => {
    const eps = getEndpointsForTier('enterprise')
    expect(eps.length).toBe(API_ENDPOINTS.length)
  })
})

describe('formatVenueResponse', () => {
  it('formats venue data', () => {
    const venue: Venue = {
      id: 'v1', name: 'Bar A', location: { lat: 40.7, lng: -74.0, address: '123 Main' },
      pulseScore: 80, city: 'NYC', state: 'NY', category: 'bar',
    }
    const resp = formatVenueResponse(venue) as Record<string, any>
    expect(resp.id).toBe('v1')
    expect(resp.name).toBe('Bar A')
    expect(resp.location.lat).toBe(40.7)
    expect(resp.pulseScore).toBe(80)
  })

  it('includes recent pulses when provided', () => {
    const venue: Venue = { id: 'v1', name: 'Bar', location: { lat: 0, lng: 0, address: '' }, pulseScore: 50 }
    const pulses: Pulse[] = [{
      id: 'p1', userId: 'u1', venueId: 'v1', photos: ['a.jpg'], energyRating: 'buzzing',
      createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(),
      reactions: { fire: [], eyes: [], skull: [], lightning: [] }, views: 10,
    }]
    const resp = formatVenueResponse(venue, pulses) as Record<string, any>
    expect(resp.recentPulses).toHaveLength(1)
    expect(resp.recentPulses[0].id).toBe('p1')
  })
})
