import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkRateLimit,
  checkUserRateLimit,
  resetRateLimit,
  clearAllRateLimits,
  detectAbuse,
  RATE_LIMITS,
} from '../rate-limiter'

beforeEach(() => {
  clearAllRateLimits()
})

describe('checkRateLimit', () => {
  it('allows requests within limit', () => {
    const config = { maxTokens: 5, refillRate: 1, windowMs: 60000 }
    const result = checkRateLimit('test-key', config)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks when tokens exhausted', () => {
    const config = { maxTokens: 2, refillRate: 0.001, windowMs: 60000 }
    checkRateLimit('exhaust', config)
    checkRateLimit('exhaust', config)
    const result = checkRateLimit('exhaust', config)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('isolates different keys', () => {
    const config = { maxTokens: 1, refillRate: 0.001, windowMs: 60000 }
    checkRateLimit('key-a', config)
    const result = checkRateLimit('key-b', config)
    expect(result.allowed).toBe(true)
  })
})

describe('checkUserRateLimit', () => {
  it('uses predefined rate limits', () => {
    const result = checkUserRateLimit('u1', 'pulse_create')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(RATE_LIMITS.pulse_create.maxTokens - 1)
  })

  it('allows unknown actions', () => {
    const result = checkUserRateLimit('u1', 'unknown_action' as any)
    expect(result.allowed).toBe(true)
  })
})

describe('resetRateLimit', () => {
  it('resets a user rate limit', () => {
    const config = { maxTokens: 1, refillRate: 0.001, windowMs: 60000 }
    checkRateLimit('u1:test', config)
    const blocked = checkRateLimit('u1:test', config)
    expect(blocked.allowed).toBe(false)

    resetRateLimit('u1', 'test')
    const afterReset = checkRateLimit('u1:test', config)
    expect(afterReset.allowed).toBe(true)
  })
})

describe('detectAbuse', () => {
  it('detects rapid fire actions', () => {
    const now = Date.now()
    const actions = Array.from({ length: 25 }, (_, i) => ({
      action: 'reaction',
      timestamp: now - i * 1000,
    }))
    const signals = detectAbuse('u1', actions)
    expect(signals.some(s => s.type === 'rapid_fire')).toBe(true)
  })

  it('detects alternating rating patterns', () => {
    const now = Date.now()
    const actions = [
      { action: 'pulse_create', timestamp: now - 5000, metadata: { energyRating: 'electric' } },
      { action: 'pulse_create', timestamp: now - 4000, metadata: { energyRating: 'dead' } },
      { action: 'pulse_create', timestamp: now - 3000, metadata: { energyRating: 'electric' } },
      { action: 'pulse_create', timestamp: now - 2000, metadata: { energyRating: 'dead' } },
      { action: 'pulse_create', timestamp: now - 1000, metadata: { energyRating: 'electric' } },
    ]
    const signals = detectAbuse('u1', actions)
    expect(signals.some(s => s.type === 'alternating_ratings')).toBe(true)
  })

  it('returns empty for normal usage', () => {
    const now = Date.now()
    const actions = [
      { action: 'venue_view', timestamp: now - 60000 },
      { action: 'pulse_create', timestamp: now - 30000, metadata: { energyRating: 'buzzing' } },
      { action: 'reaction', timestamp: now - 10000 },
    ]
    const signals = detectAbuse('u1', actions)
    expect(signals.length).toBe(0)
  })
})
