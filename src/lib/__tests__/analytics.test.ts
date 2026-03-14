import { describe, it, expect, beforeEach } from 'vitest'
import {
  trackEvent,
  getEvents,
  clearEvents,
  analyzeOnboardingFunnel,
  analyzeCoreLoop,
  analyzeSeededContent,
  calculateRetention,
  getErrorSummary,
  getIntegrationActionSummary,
  type AnalyticsEvent,
} from '../analytics'

beforeEach(() => {
  clearEvents()
})

describe('trackEvent / getEvents', () => {
  it('tracks and retrieves events', () => {
    trackEvent({ type: 'app_open', timestamp: Date.now() })
    trackEvent({ type: 'venue_view', timestamp: Date.now(), venueId: 'v1', source: 'map' })
    expect(getEvents().length).toBe(2)
  })

  it('filters by type', () => {
    trackEvent({ type: 'app_open', timestamp: Date.now() })
    trackEvent({ type: 'venue_view', timestamp: Date.now(), venueId: 'v1', source: 'map' })
    expect(getEvents('app_open').length).toBe(1)
  })

  it('clears events', () => {
    trackEvent({ type: 'app_open', timestamp: Date.now() })
    clearEvents()
    expect(getEvents().length).toBe(0)
  })
})

describe('analyzeOnboardingFunnel', () => {
  it('calculates funnel steps', () => {
    const events: AnalyticsEvent[] = [
      { type: 'app_open', timestamp: 1 },
      { type: 'app_open', timestamp: 2 },
      { type: 'onboarding_start', timestamp: 3 },
      { type: 'onboarding_start', timestamp: 4 },
      { type: 'onboarding_complete', timestamp: 5, durationMs: 10000 },
      { type: 'pulse_submit', timestamp: 6, venueId: 'v1', energyRating: 'buzzing', hasPhoto: false, hasCaption: true, hashtagCount: 0 },
    ]
    const funnel = analyzeOnboardingFunnel(events)
    expect(funnel.steps[0].count).toBe(2) // app opens
    expect(funnel.steps[1].count).toBe(2) // onboarding starts
    expect(funnel.steps[2].count).toBe(1) // onboarding completes
    expect(funnel.totalConversionRate).toBeGreaterThan(0)
  })

  it('handles empty events', () => {
    const funnel = analyzeOnboardingFunnel([])
    expect(funnel.totalConversionRate).toBe(0)
  })
})

describe('analyzeCoreLoop', () => {
  it('calculates core loop metrics', () => {
    const events: AnalyticsEvent[] = [
      { type: 'app_open', timestamp: 1 },
      { type: 'venue_view', timestamp: 2, venueId: 'v1', source: 'trending' },
      { type: 'pulse_submit', timestamp: 3, venueId: 'v1', energyRating: 'buzzing', hasPhoto: true, hasCaption: true, hashtagCount: 2 },
      { type: 'venue_discovery', timestamp: 4, venueId: 'v2', method: 'trending' },
    ]
    const metrics = analyzeCoreLoop(events)
    expect(metrics.sessionsCount).toBe(1)
    expect(metrics.venueViewsPerSession).toBe(1)
    expect(metrics.pulsesPerSession).toBe(1)
    expect(metrics.coreLoopCompletionRate).toBe(1)
  })

  it('reports incomplete loop', () => {
    const events: AnalyticsEvent[] = [
      { type: 'app_open', timestamp: 1 },
      { type: 'venue_view', timestamp: 2, venueId: 'v1', source: 'map' },
    ]
    const metrics = analyzeCoreLoop(events)
    expect(metrics.coreLoopCompletionRate).toBe(0)
  })
})

describe('analyzeSeededContent', () => {
  it('calculates seeded content metrics', () => {
    const venues = [
      { id: 'v1', seeded: true, firstRealCheckInAt: '2025-01-02T00:00:00Z', createdAt: '2025-01-01T00:00:00Z' },
      { id: 'v2', seeded: true, createdAt: '2025-01-01T00:00:00Z' },
      { id: 'v3', seeded: false, createdAt: '2025-01-01T00:00:00Z' },
    ]
    const hashtags = [
      { name: '#happy', seeded: true, verifiedUsageCount: 5 },
      { name: '#live', seeded: true, verifiedUsageCount: 0 },
      { name: '#user', seeded: false, verifiedUsageCount: 10 },
    ]
    const metrics = analyzeSeededContent(venues, hashtags)
    expect(metrics.totalSeededVenues).toBe(2)
    expect(metrics.seededWithRealActivity).toBe(1)
    expect(metrics.conversionRate).toBe(0.5)
    expect(metrics.seededHashtagConversionRate).toBe(0.5)
    expect(metrics.averageTimeToFirstActivity).toBeGreaterThan(0)
  })
})

describe('calculateRetention', () => {
  it('calculates day-by-day retention', () => {
    const cohortDate = '2025-01-01T00:00:00Z'
    const cohortUsers = [
      { userId: 'u1', joinDate: cohortDate },
      { userId: 'u2', joinDate: cohortDate },
      { userId: 'u3', joinDate: cohortDate },
    ]
    const day = 24 * 60 * 60 * 1000
    const baseTime = new Date(cohortDate).getTime()
    const activityLog = [
      { userId: 'u1', timestamp: baseTime + 1 * day + 1000 }, // Day 1
      { userId: 'u2', timestamp: baseTime + 1 * day + 2000 }, // Day 1
      { userId: 'u1', timestamp: baseTime + 2 * day + 1000 }, // Day 2
      { userId: 'u1', timestamp: baseTime + 7 * day + 1000 }, // Day 7
    ]
    const retention = calculateRetention(cohortUsers, activityLog)
    expect(retention.totalUsers).toBe(3)
    expect(retention.retainedByDay[1]).toBe(2) // u1 + u2 on day 1
    expect(retention.retainedByDay[2]).toBe(1) // u1 on day 2
    expect(retention.retainedByDay[7]).toBe(1) // u1 on day 7
  })
})

describe('getErrorSummary', () => {
  it('summarizes errors', () => {
    const events: AnalyticsEvent[] = [
      { type: 'error', timestamp: 1, message: 'Network error' },
      { type: 'error', timestamp: 2, message: 'Network error' },
      { type: 'error', timestamp: 3, message: 'Parse error' },
      { type: 'app_open', timestamp: 4 },
    ]
    const summary = getErrorSummary(events)
    expect(summary.totalErrors).toBe(3)
    expect(summary.uniqueErrors).toBe(2)
    expect(summary.topErrors[0].message).toBe('Network error')
    expect(summary.topErrors[0].count).toBe(2)
  })
})

describe('getIntegrationActionSummary', () => {
  it('summarizes integration outcomes by type and provider', () => {
    const events: AnalyticsEvent[] = [
      { type: 'integration_action', timestamp: 1, venueId: 'v1', integrationType: 'music', actionId: 'open_music', provider: 'spotify', outcome: 'success' },
      { type: 'integration_action', timestamp: 2, venueId: 'v1', integrationType: 'rideshare', actionId: 'open_uber', provider: 'uber', outcome: 'failed', reason: 'popup-blocked' },
      { type: 'integration_action', timestamp: 3, venueId: 'v2', integrationType: 'shortcuts', actionId: 'friends', outcome: 'unavailable', reason: 'No recent friend activity yet.' },
      { type: 'app_open', timestamp: 4 },
    ]

    const summary = getIntegrationActionSummary(events)
    expect(summary.totalActions).toBe(3)
    expect(summary.successCount).toBe(1)
    expect(summary.failureCount).toBe(1)
    expect(summary.unavailableCount).toBe(1)
    expect(summary.actionsByType.music).toBe(1)
    expect(summary.actionsByType.rideshare).toBe(1)
    expect(summary.topProviders[0].provider).toBe('spotify')
    expect(summary.recentFailures[0].timestamp).toBe(3)
  })
})
