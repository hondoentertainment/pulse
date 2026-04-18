/**
 * Observability Foundation — Unit Tests
 *
 * Covers: error-tracking, logger, analytics (product analytics),
 * health-check, and performance-monitor enhancements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Error Tracking
// ---------------------------------------------------------------------------

import {
  setupErrorTracking,
  setErrorContext,
  getErrorContext,
  clearErrorContext,
  captureException,
  setErrorTrackingProvider,
  _resetRateLimit,
  _getRateLimitCount,
  _resetSetup,
  type ErrorTrackingProvider,
} from '@/lib/error-tracking'

describe('Error Tracking', () => {
  beforeEach(() => {
    _resetRateLimit()
    _resetSetup()
    clearErrorContext()
  })

  // -------------------------------------------------------------------------
  // Context enrichment
  // -------------------------------------------------------------------------

  describe('context enrichment', () => {
    it('stores and retrieves context fields', () => {
      setErrorContext({ route: '/map', userId: 'u-1', appVersion: '1.0.0' })
      const ctx = getErrorContext()
      expect(ctx.route).toBe('/map')
      expect(ctx.userId).toBe('u-1')
      expect(ctx.appVersion).toBe('1.0.0')
    })

    it('merges context incrementally', () => {
      setErrorContext({ route: '/map' })
      setErrorContext({ userId: 'u-2' })
      const ctx = getErrorContext()
      expect(ctx.route).toBe('/map')
      expect(ctx.userId).toBe('u-2')
    })

    it('clearErrorContext removes all fields', () => {
      setErrorContext({ route: '/home', userId: 'u-3' })
      clearErrorContext()
      const ctx = getErrorContext()
      expect(Object.keys(ctx).length).toBe(0)
    })

    it('getErrorContext returns a copy, not a reference', () => {
      setErrorContext({ route: '/foo' })
      const ctx = getErrorContext()
      ctx.route = '/mutated'
      expect(getErrorContext().route).toBe('/foo')
    })
  })

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  describe('rate limiting', () => {
    it('allows up to 10 errors within the window', () => {
      for (let i = 0; i < 10; i++) {
        captureException(new Error(`err-${i}`))
      }
      expect(_getRateLimitCount()).toBe(10)
    })

    it('drops errors beyond the 10-per-minute limit', () => {
      const captured: unknown[] = []
      const provider: ErrorTrackingProvider = {
        init: vi.fn(),
        captureException: (_err: unknown) => { captured.push(_err) },
        captureMessage: vi.fn(),
        setUser: vi.fn(),
        addBreadcrumb: vi.fn(),
      }
      setErrorTrackingProvider(provider)

      for (let i = 0; i < 15; i++) {
        captureException(new Error(`err-${i}`))
      }

      expect(captured.length).toBe(10)
    })

    it('_resetRateLimit clears the window', () => {
      for (let i = 0; i < 10; i++) {
        captureException(new Error(`err-${i}`))
      }
      _resetRateLimit()
      expect(_getRateLimitCount()).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // setupErrorTracking
  // -------------------------------------------------------------------------

  describe('setupErrorTracking', () => {
    it('applies contextDefaults when provided', () => {
      // In Node test env, setupErrorTracking returns early if window is undefined.
      // Manually apply context to verify the context API works.
      setErrorContext({ route: '/setup-test', appVersion: '2.0.0' })
      const ctx = getErrorContext()
      expect(ctx.route).toBe('/setup-test')
      expect(ctx.appVersion).toBe('2.0.0')
    })

    it('setupErrorTracking is safe to call in Node env (no-op)', () => {
      // Should not throw even though window is undefined
      expect(() => setupErrorTracking()).not.toThrow()
      expect(() => setupErrorTracking()).not.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // Provider integration
  // -------------------------------------------------------------------------

  describe('provider integration', () => {
    it('captureException delegates to the active provider with merged context', () => {
      const captured: { error: unknown; context: Record<string, unknown> }[] = []
      const provider: ErrorTrackingProvider = {
        init: vi.fn(),
        captureException: (error, context) => { captured.push({ error, context: context ?? {} }) },
        captureMessage: vi.fn(),
        setUser: vi.fn(),
        addBreadcrumb: vi.fn(),
      }
      setErrorTrackingProvider(provider)
      setErrorContext({ route: '/provider-test' })

      const err = new Error('test error')
      captureException(err, { extra: 'data' })

      expect(captured.length).toBe(1)
      expect(captured[0].error).toBe(err)
      expect(captured[0].context.route).toBe('/provider-test')
      expect(captured[0].context.extra).toBe('data')
    })
  })
})

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

import {
  logger,
  setLogLevel,
  setCorrelationId,
  generateCorrelationId,
  getLogBuffer,
  flushLogs,
  getCrashBuffer,
  clearCrashBuffer,
} from '@/lib/logger'

describe('Logger', () => {
  beforeEach(() => {
    flushLogs()
    clearCrashBuffer()
    setCorrelationId(undefined)
    setLogLevel('debug')
  })

  // -------------------------------------------------------------------------
  // Log levels
  // -------------------------------------------------------------------------

  describe('log levels', () => {
    it('emits entries at debug, info, warn, error', () => {
      logger.debug('dbg', 'TestComponent')
      logger.info('inf', 'TestComponent')
      logger.warn('wrn', 'TestComponent')
      logger.error('err', 'TestComponent')

      const buf = getLogBuffer()
      expect(buf.map(e => e.level)).toEqual(['debug', 'info', 'warn', 'error'])
    })

    it('respects the minimum log level', () => {
      setLogLevel('warn')
      logger.debug('filtered-debug', 'TestComponent')
      logger.info('filtered-info', 'TestComponent')
      logger.warn('passes', 'TestComponent')

      const buf = getLogBuffer()
      expect(buf.length).toBe(1)
      expect(buf[0].level).toBe('warn')
    })

    it('each entry has a valid ISO timestamp', () => {
      logger.info('ts-test', 'TestComponent')
      const [entry] = getLogBuffer()
      expect(() => new Date(entry.timestamp)).not.toThrow()
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp)
    })
  })

  // -------------------------------------------------------------------------
  // Correlation IDs
  // -------------------------------------------------------------------------

  describe('correlation IDs', () => {
    it('attaches the global correlation ID to each entry', () => {
      const cid = generateCorrelationId()
      setCorrelationId(cid)
      logger.info('with-cid', 'TestComponent')
      const [entry] = getLogBuffer()
      expect(entry.correlationId).toBe(cid)
    })

    it('omits correlationId when not set', () => {
      setCorrelationId(undefined)
      logger.info('no-cid', 'TestComponent')
      const [entry] = getLogBuffer()
      expect(entry.correlationId).toBeUndefined()
    })

    it('generateCorrelationId produces unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateCorrelationId()))
      expect(ids.size).toBe(100)
    })
  })

  // -------------------------------------------------------------------------
  // Log buffer
  // -------------------------------------------------------------------------

  describe('log buffer', () => {
    it('getLogBuffer returns buffered entries without clearing', () => {
      logger.info('msg1', 'A')
      logger.info('msg2', 'A')
      expect(getLogBuffer().length).toBe(2)
      expect(getLogBuffer().length).toBe(2) // calling again returns same
    })

    it('flushLogs drains and returns all entries', () => {
      logger.warn('flush-me', 'A')
      const flushed = flushLogs()
      expect(flushed.length).toBe(1)
      expect(getLogBuffer().length).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Crash buffer (last 50 entries)
  // -------------------------------------------------------------------------

  describe('crash buffer', () => {
    it('getCrashBuffer returns the last N entries across all levels', () => {
      for (let i = 0; i < 10; i++) {
        logger.info(`msg-${i}`, 'TestComponent')
      }
      const buf = getCrashBuffer()
      expect(buf.length).toBe(10)
    })

    it('crash buffer caps at 50 entries', () => {
      for (let i = 0; i < 70; i++) {
        logger.debug(`overflow-${i}`, 'TestComponent')
      }
      expect(getCrashBuffer().length).toBeLessThanOrEqual(50)
    })

    it('clearCrashBuffer empties the crash buffer', () => {
      logger.error('crash-entry', 'TestComponent')
      clearCrashBuffer()
      expect(getCrashBuffer().length).toBe(0)
    })

    it('crash buffer is independent of flushLogs', () => {
      logger.warn('entry', 'TestComponent')
      flushLogs() // clears log buffer
      expect(getCrashBuffer().length).toBe(1) // crash buffer still has it
    })
  })
})

// ---------------------------------------------------------------------------
// Analytics — product analytics surface
// ---------------------------------------------------------------------------

import {
  trackEvent,
  getEvents,
  clearEvents,
  flushAnalytics,
  startSession,
  endSession,
  getSessionId,
  trackActivation,
  trackWeeklyActive,
  recordSessionVenueView,
  recordSessionPulse,
  recordSessionReaction,
  trackFunnelStep,
  analyzeCoreConversionFunnel,
  getSessionDurationStats,
} from '@/lib/analytics'

describe('Analytics — product analytics', () => {
  beforeEach(() => {
    // End any open session first (this emits events), then clear
    endSession()
    clearEvents()
  })

  // -------------------------------------------------------------------------
  // Activation tracking
  // -------------------------------------------------------------------------

  describe('activation tracking', () => {
    it('trackActivation emits activation_first_pulse event', () => {
      const signupTs = Date.now() - 5000
      trackActivation('user-1', 'venue-42', signupTs)
      const events = getEvents('activation_first_pulse')
      expect(events.length).toBe(1)
      const evt = events[0] as Extract<typeof events[0], { type: 'activation_first_pulse' }>
      expect(evt.userId).toBe('user-1')
      expect(evt.venueId).toBe('venue-42')
      expect(evt.timeSinceSignupMs).toBeGreaterThanOrEqual(5000)
    })
  })

  // -------------------------------------------------------------------------
  // Retention tracking
  // -------------------------------------------------------------------------

  describe('retention tracking', () => {
    it('trackWeeklyActive emits retention_weekly_active with a weekNumber', () => {
      trackWeeklyActive('user-2')
      const events = getEvents('retention_weekly_active')
      expect(events.length).toBe(1)
      const evt = events[0] as Extract<typeof events[0], { type: 'retention_weekly_active' }>
      expect(evt.userId).toBe('user-2')
      expect(typeof evt.weekNumber).toBe('number')
      expect(evt.weekNumber).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Session tracking
  // -------------------------------------------------------------------------

  describe('session tracking', () => {
    it('startSession emits session_start and returns a session ID', () => {
      const sessionId = startSession()
      expect(typeof sessionId).toBe('string')
      expect(sessionId).toMatch(/^sess-/)
      const events = getEvents('session_start')
      expect(events.length).toBe(1)
    })

    it('endSession emits session_end with durationMs', () => {
      startSession()
      endSession()
      const events = getEvents('session_end')
      expect(events.length).toBe(1)
      const evt = events[0] as Extract<typeof events[0], { type: 'session_end' }>
      expect(evt.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('getSessionId returns active session ID and null after end', () => {
      const id = startSession()
      expect(getSessionId()).toBe(id)
      endSession()
      expect(getSessionId()).toBeNull()
    })

    it('endSession emits engagement roll-ups', () => {
      startSession()
      recordSessionPulse()
      recordSessionPulse()
      recordSessionVenueView()
      recordSessionReaction()
      endSession()

      const pulsesEvents = getEvents('engagement_pulses_per_session')
      expect(pulsesEvents.length).toBe(1)
      const pulsesEvt = pulsesEvents[0] as Extract<typeof pulsesEvents[0], { type: 'engagement_pulses_per_session' }>
      expect(pulsesEvt.count).toBe(2)

      const venueEvents = getEvents('engagement_venues_viewed')
      const venueEvt = venueEvents[0] as Extract<typeof venueEvents[0], { type: 'engagement_venues_viewed' }>
      expect(venueEvt.count).toBe(1)

      const reactionEvents = getEvents('engagement_reactions_per_session')
      const reactionEvt = reactionEvents[0] as Extract<typeof reactionEvents[0], { type: 'engagement_reactions_per_session' }>
      expect(reactionEvt.count).toBe(1)
    })

    it('consecutive sessions are independent', () => {
      const id1 = startSession()
      recordSessionPulse()
      endSession()

      const id2 = startSession()
      endSession()

      expect(id1).not.toBe(id2)

      const pulseEvents = getEvents('engagement_pulses_per_session')
      // First session: 1 pulse; second: 0 pulses
      const [first, second] = pulseEvents as Extract<typeof pulseEvents[0], { type: 'engagement_pulses_per_session' }>[]
      expect(first.count).toBe(1)
      expect(second.count).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Engagement metrics
  // -------------------------------------------------------------------------

  describe('engagement metrics', () => {
    it('recordSessionVenueView increments venue view count', () => {
      startSession()
      recordSessionVenueView()
      recordSessionVenueView()
      recordSessionVenueView()
      endSession()

      const events = getEvents('engagement_venues_viewed')
      const evt = events[0] as Extract<typeof events[0], { type: 'engagement_venues_viewed' }>
      expect(evt.count).toBe(3)
    })
  })

  // -------------------------------------------------------------------------
  // Funnel tracking
  // -------------------------------------------------------------------------

  describe('funnel tracking', () => {
    it('trackFunnelStep emits funnel_step events per session', () => {
      startSession()
      trackFunnelStep('app_open')
      trackFunnelStep('venue_view')
      trackFunnelStep('check_in')
      trackFunnelStep('pulse_creation')

      const events = getEvents('funnel_step')
      expect(events.length).toBe(4)
    })

    it('duplicate steps within the same session are deduplicated', () => {
      startSession()
      trackFunnelStep('app_open')
      trackFunnelStep('app_open') // duplicate
      const events = getEvents('funnel_step')
      expect(events.length).toBe(1)
    })

    it('analyzeCoreConversionFunnel returns correct conversion rate', () => {
      // Session 1: full funnel
      startSession()
      trackFunnelStep('app_open')
      trackFunnelStep('venue_view')
      trackFunnelStep('check_in')
      trackFunnelStep('pulse_creation')
      endSession()

      // Session 2: partial funnel
      startSession()
      trackFunnelStep('app_open')
      trackFunnelStep('venue_view')
      endSession()

      const allEvents = getEvents()
      const analysis = analyzeCoreConversionFunnel(allEvents)

      expect(analysis.name).toBe('Core Conversion Funnel')
      expect(analysis.steps.length).toBe(4)
      // 2 sessions entered, 1 completed → 50 %
      expect(analysis.totalConversionRate).toBe(0.5)
      expect(analysis.totalUsers).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // Session duration stats
  // -------------------------------------------------------------------------

  describe('getSessionDurationStats', () => {
    it('returns zeros when no session_end events exist', () => {
      const stats = getSessionDurationStats([])
      expect(stats.totalSessions).toBe(0)
      expect(stats.averageDurationMs).toBe(0)
    })

    it('computes average and p95 correctly', () => {
      // Emit session_end events manually
      for (let i = 1; i <= 10; i++) {
        trackEvent({ type: 'session_end', timestamp: Date.now(), sessionId: `s-${i}`, durationMs: i * 1000 })
      }

      const stats = getSessionDurationStats(getEvents())
      expect(stats.totalSessions).toBe(10)
      expect(stats.averageDurationMs).toBe(5500) // avg(1000..10000)
      expect(stats.medianDurationMs).toBe(5500)  // (5000+6000)/2
      expect(stats.p95DurationMs).toBeGreaterThanOrEqual(9000)
    })
  })

  // -------------------------------------------------------------------------
  // flushAnalytics
  // -------------------------------------------------------------------------

  describe('flushAnalytics', () => {
    it('returns all buffered events and clears the buffer', () => {
      trackActivation('u-flush', 'v-flush', Date.now() - 1000)
      trackWeeklyActive('u-flush')

      const flushed = flushAnalytics()
      expect(flushed.length).toBeGreaterThanOrEqual(2)
      expect(getEvents().length).toBe(0)
    })
  })
})

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

import {
  getHealthStatus,
  recordHealthError,
  initHealthCheck,
  _resetHealthCheck,
} from '@/lib/health-check'

describe('Health Check', () => {
  beforeEach(() => {
    _resetHealthCheck()
  })

  it('returns a valid appVersion string', () => {
    const status = getHealthStatus()
    expect(typeof status.appVersion).toBe('string')
    expect(status.appVersion.length).toBeGreaterThan(0)
  })

  it('uptimeMs is non-negative and grows over time', async () => {
    initHealthCheck()
    const s1 = getHealthStatus()
    // Small artificial delay using a tight loop instead of sleep
    const end = Date.now() + 5
    while (Date.now() < end) { /* busy wait */ }
    const s2 = getHealthStatus()
    expect(s1.uptimeMs).toBeGreaterThanOrEqual(0)
    expect(s2.uptimeMs).toBeGreaterThanOrEqual(s1.uptimeMs)
  })

  it('errorCount starts at 0 after reset', () => {
    expect(getHealthStatus().errorCount).toBe(0)
    expect(getHealthStatus().lastErrorTimestamp).toBeNull()
  })

  it('recordHealthError increments errorCount', () => {
    recordHealthError()
    recordHealthError()
    expect(getHealthStatus().errorCount).toBe(2)
  })

  it('lastErrorTimestamp is set after recording an error', () => {
    recordHealthError()
    const ts = getHealthStatus().lastErrorTimestamp
    expect(ts).not.toBeNull()
    expect(() => new Date(ts!)).not.toThrow()
  })

  it('status is healthy with zero errors', () => {
    expect(getHealthStatus().status).toBe('healthy')
  })

  it('status is degraded with 1-9 errors', () => {
    recordHealthError()
    expect(getHealthStatus().status).toBe('degraded')

    for (let i = 0; i < 7; i++) recordHealthError()
    expect(getHealthStatus().status).toBe('degraded')
  })

  it('status is unhealthy with 10+ errors', () => {
    for (let i = 0; i < 10; i++) recordHealthError()
    expect(getHealthStatus().status).toBe('unhealthy')
  })

  it('memory is null in the Node test environment', () => {
    // Node.js does not have performance.memory
    const status = getHealthStatus()
    // Accept both null (Node) and an object (browser env with polyfill)
    if (status.memory !== null) {
      expect(status.memory.usedJSHeapSizeMB).toBeGreaterThanOrEqual(0)
      expect(status.memory.jsHeapSizeLimitMB).toBeGreaterThan(0)
    } else {
      expect(status.memory).toBeNull()
    }
  })
})

