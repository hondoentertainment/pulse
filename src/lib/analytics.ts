/**
 * Analytics & Observability Engine
 *
 * Event tracking for core loop, funnel analysis, activation, retention,
 * feature usage, A/B testing, performance, and error monitoring.
 *
 * Privacy guarantees:
 * - No PII (names, emails, phone numbers) in any event payload
 * - Honors navigator.doNotTrack; when set, only error/performance events fire
 * - Batch sending reduces network overhead (max 20 events per flush)
 */

import { track as vercelTrack } from '@vercel/analytics'
import * as Sentry from '@sentry/react'

// ---------------------------------------------------------------------------
// Event type definitions
// ---------------------------------------------------------------------------

export type AnalyticsEvent =
  // Session
  | { type: 'app_open'; timestamp: number }
  | { type: 'session_end'; timestamp: number; durationMs: number; screenCount: number }
  // Onboarding
  | { type: 'onboarding_start'; timestamp: number }
  | { type: 'onboarding_step'; timestamp: number; step: string; stepIndex: number }
  | { type: 'onboarding_complete'; timestamp: number; durationMs: number }
  // Activation (first-time milestones)
  | { type: 'activation_first_pulse'; timestamp: number; venueId: string }
  | { type: 'activation_first_checkin'; timestamp: number; venueId: string }
  | { type: 'activation_first_friend'; timestamp: number; method: string }
  | { type: 'activation_first_reaction'; timestamp: number; reactionType: string }
  // Retention proxy (DAU/WAU/MAU — no PII, just presence signals)
  | { type: 'dau_ping'; timestamp: number; dayOfWeek: number }
  | { type: 'wau_ping'; timestamp: number; weekNumber: number }
  | { type: 'mau_ping'; timestamp: number; monthYear: string }
  // Venue
  | { type: 'venue_view'; timestamp: number; venueId: string; source: 'map' | 'trending' | 'search' | 'notification' | 'deeplink' }
  | { type: 'venue_discovery'; timestamp: number; venueId: string; method: 'trending' | 'map' | 'search' | 'friend_activity' }
  // Pulse
  | { type: 'pulse_start'; timestamp: number; venueId: string }
  | { type: 'pulse_submit'; timestamp: number; venueId: string; energyRating: string; hasPhoto: boolean; hasCaption: boolean; hashtagCount: number }
  | { type: 'pulse_reaction'; timestamp: number; pulseId: string; reactionType: string }
  // Check-in
  | { type: 'checkin_start'; timestamp: number; venueId: string }
  | { type: 'checkin_complete'; timestamp: number; venueId: string; crewSize: number }
  // Social
  | { type: 'friend_add'; timestamp: number; method: 'qr' | 'search' | 'suggestion' | 'invite' }
  | { type: 'share'; timestamp: number; contentType: 'venue' | 'pulse' | 'invite'; method: 'native' | 'clipboard' | 'story' }
  // Neighborhood
  | { type: 'neighborhood_view'; timestamp: number; neighborhoodCount: number }
  | { type: 'neighborhood_hottest_click'; timestamp: number; neighborhoodId: string; city?: string }
  | { type: 'neighborhood_venue_click'; timestamp: number; neighborhoodId: string; venueId: string }
  // Integrations
  | { type: 'integration_action'; timestamp: number; venueId: string; integrationType: 'rideshare' | 'music' | 'reservation' | 'maps' | 'shortcuts'; actionId: string; provider?: string; outcome: 'success' | 'unavailable' | 'failed'; reason?: string }
  // Events
  | { type: 'event_rsvp'; timestamp: number; eventId: string; status: string }
  // Feature usage
  | { type: 'feature_used'; timestamp: number; feature: string; action: string; durationMs?: number }
  // A/B testing
  | { type: 'ab_exposure'; timestamp: number; experiment: string; variant: string }
  | { type: 'ab_conversion'; timestamp: number; experiment: string; variant: string; goal: string }
  // Performance
  | { type: 'performance'; timestamp: number; metric: string; value: number; unit: string }
  | { type: 'page_load'; timestamp: number; route: string; ttfbMs: number; lcpMs?: number; fidMs?: number; clsScore?: number }
  | { type: 'interaction_delay'; timestamp: number; element: string; delayMs: number }
  // Errors
  | { type: 'error'; timestamp: number; message: string; stack?: string; context?: string }

// ---------------------------------------------------------------------------
// User properties (no PII)
// ---------------------------------------------------------------------------

export interface UserProperties {
  /** Days since account creation */
  accountAgeDays: number
  /** Total lifetime pulse count */
  pulseCount: number
  /** Total friend/follower count */
  friendCount: number
  /** Preferred city or region code — not city name to avoid re-identification */
  regionCode?: string
  /** App version string */
  appVersion?: string
}

// ---------------------------------------------------------------------------
// Supporting interfaces (kept from original)
// ---------------------------------------------------------------------------

export interface FunnelStep {
  name: string
  count: number
  dropoffRate: number
}

export interface FunnelAnalysis {
  name: string
  steps: FunnelStep[]
  totalConversionRate: number
  totalUsers: number
}

export interface RetentionCohort {
  cohortDate: string
  totalUsers: number
  retainedByDay: Record<number, number>
}

export interface CoreLoopMetrics {
  sessionsCount: number
  venueViewsPerSession: number
  pulsesPerSession: number
  reactionsPerSession: number
  discoveryActionsPerSession: number
  coreLoopCompletionRate: number
}

export interface SocialConversionMetrics {
  friendAdds: number
  usersWithFriendAdds: number
  usersWithFriendAddThenPulse: number
  conversionRate: number
}

export interface SeededContentMetrics {
  totalSeededVenues: number
  seededWithRealActivity: number
  conversionRate: number
  averageTimeToFirstActivity: number
  seededHashtagConversionRate: number
}

export interface IntegrationActionSummary {
  totalActions: number
  successCount: number
  unavailableCount: number
  failureCount: number
  actionsByType: Record<'rideshare' | 'music' | 'reservation' | 'maps' | 'shortcuts', number>
  topProviders: { provider: string; count: number }[]
  recentFailures: Extract<AnalyticsEvent, { type: 'integration_action' }>[]
}

// ---------------------------------------------------------------------------
// Privacy helpers
// ---------------------------------------------------------------------------

function isDoNotTrack(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes'
}

/** Events that fire even when DNT is enabled (operational/security signals). */
const ALWAYS_ALLOWED: AnalyticsEvent['type'][] = ['error', 'performance', 'page_load']

function isAllowed(type: AnalyticsEvent['type']): boolean {
  if (!isDoNotTrack()) return true
  return (ALWAYS_ALLOWED as string[]).includes(type)
}

// ---------------------------------------------------------------------------
// In-memory event log
// ---------------------------------------------------------------------------

const eventLog: AnalyticsEvent[] = []
const MAX_EVENTS = 10_000

// ---------------------------------------------------------------------------
// Batch send queue
// ---------------------------------------------------------------------------

const BATCH_SIZE = 20
const BATCH_INTERVAL_MS = 5_000

const batchQueue: AnalyticsEvent[] = []
let batchTimer: ReturnType<typeof setTimeout> | null = null

function scheduleBatchFlush(): void {
  if (batchTimer !== null) return
  batchTimer = setTimeout(() => {
    flushBatch()
  }, BATCH_INTERVAL_MS)
}

function flushBatch(): void {
  batchTimer = null
  if (batchQueue.length === 0) return

  const batch = batchQueue.splice(0, BATCH_SIZE)

  for (const event of batch) {
    try {
      const { type, timestamp, ...properties } = event
      vercelTrack(type, properties as Record<string, string | number | boolean | null>)
    } catch {
      // Vercel Analytics is best-effort; never crash on tracking failure
    }
  }

  // If more events queued, reschedule
  if (batchQueue.length > 0) {
    scheduleBatchFlush()
  }
}

/**
 * Flush all queued events immediately (useful before page unload).
 */
export function flushEvents(): void {
  flushBatch()
}

// Flush on page unload to avoid losing events
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBatch()
  })
  window.addEventListener('pagehide', flushBatch)
}

// ---------------------------------------------------------------------------
// Core tracking
// ---------------------------------------------------------------------------

/**
 * Track an analytics event.
 *
 * - Respects Do Not Track for non-operational events
 * - Buffers events for batch sending to Vercel Analytics
 * - Always stores in the local event log for in-session analysis
 */
export function trackEvent(event: AnalyticsEvent): void {
  // Always store locally
  eventLog.push(event)
  if (eventLog.length > MAX_EVENTS) {
    eventLog.splice(0, eventLog.length - MAX_EVENTS)
  }

  // Respect DNT for external forwarding
  if (!isAllowed(event.type)) return

  batchQueue.push(event)
  if (batchQueue.length >= BATCH_SIZE) {
    flushBatch()
  } else {
    scheduleBatchFlush()
  }
}

/**
 * Get all tracked events, optionally filtered by type.
 */
export function getEvents(type?: AnalyticsEvent['type']): AnalyticsEvent[] {
  if (!type) return [...eventLog]
  return eventLog.filter((e) => e.type === type)
}

/**
 * Clear all events (e.g., after a test or logout).
 */
export function clearEvents(): void {
  eventLog.length = 0
  batchQueue.length = 0
}

// ---------------------------------------------------------------------------
// Activation events
// ---------------------------------------------------------------------------

const activationSent = new Set<string>()

/**
 * Track a first-time activation milestone. Fires only once per session.
 */
export function trackActivation(
  milestone: 'first_pulse' | 'first_checkin' | 'first_friend' | 'first_reaction',
  meta: Record<string, string>
): void {
  if (activationSent.has(milestone)) return
  activationSent.add(milestone)

  const now = Date.now()
  switch (milestone) {
    case 'first_pulse':
      trackEvent({ type: 'activation_first_pulse', timestamp: now, venueId: meta.venueId ?? '' })
      break
    case 'first_checkin':
      trackEvent({ type: 'activation_first_checkin', timestamp: now, venueId: meta.venueId ?? '' })
      break
    case 'first_friend':
      trackEvent({ type: 'activation_first_friend', timestamp: now, method: meta.method ?? 'unknown' })
      break
    case 'first_reaction':
      trackEvent({ type: 'activation_first_reaction', timestamp: now, reactionType: meta.reactionType ?? 'unknown' })
      break
  }
}

// ---------------------------------------------------------------------------
// Retention pings
// ---------------------------------------------------------------------------

const RETENTION_STORAGE_KEY = 'pulse_retention_pings'

interface RetentionState {
  lastDauDate: string | null
  lastWauWeek: string | null
  lastMauMonth: string | null
}

function getRetentionState(): RetentionState {
  try {
    return JSON.parse(localStorage.getItem(RETENTION_STORAGE_KEY) ?? 'null') ?? {
      lastDauDate: null,
      lastWauWeek: null,
      lastMauMonth: null,
    }
  } catch {
    return { lastDauDate: null, lastWauWeek: null, lastMauMonth: null }
  }
}

function saveRetentionState(state: RetentionState): void {
  try {
    localStorage.setItem(RETENTION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Send DAU/WAU/MAU retention pings on app open. Safe to call multiple times
 * per session — deduplicates using localStorage timestamps.
 */
export function trackRetentionPings(): void {
  const now = new Date()
  const state = getRetentionState()
  const changed: Partial<RetentionState> = {}

  // DAU: once per calendar day
  const today = now.toISOString().slice(0, 10)
  if (state.lastDauDate !== today) {
    trackEvent({ type: 'dau_ping', timestamp: Date.now(), dayOfWeek: now.getDay() })
    changed.lastDauDate = today
  }

  // WAU: once per ISO week (year-week)
  const week = `${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, '0')}`
  if (state.lastWauWeek !== week) {
    trackEvent({ type: 'wau_ping', timestamp: Date.now(), weekNumber: getISOWeek(now) })
    changed.lastWauWeek = week
  }

  // MAU: once per calendar month
  const month = now.toISOString().slice(0, 7)
  if (state.lastMauMonth !== month) {
    trackEvent({ type: 'mau_ping', timestamp: Date.now(), monthYear: month })
    changed.lastMauMonth = month
  }

  if (Object.keys(changed).length > 0) {
    saveRetentionState({ ...state, ...changed })
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

// ---------------------------------------------------------------------------
// Feature usage tracking
// ---------------------------------------------------------------------------

/**
 * Track feature usage with an optional duration.
 *
 * @example
 * const start = Date.now()
 * // ... user interaction
 * trackFeatureUsage('smartMap', 'heatmap_toggle', Date.now() - start)
 */
export function trackFeatureUsage(feature: string, action: string, durationMs?: number): void {
  trackEvent({ type: 'feature_used', timestamp: Date.now(), feature, action, durationMs })
}

// ---------------------------------------------------------------------------
// A/B test tracking
// ---------------------------------------------------------------------------

const abExposures = new Map<string, string>()

/**
 * Record exposure to an A/B experiment variant.
 * Fires only once per experiment per session.
 */
export function trackABExposure(experiment: string, variant: string): void {
  if (abExposures.has(experiment)) return
  abExposures.set(experiment, variant)
  trackEvent({ type: 'ab_exposure', timestamp: Date.now(), experiment, variant })
}

/**
 * Record a conversion event for an A/B experiment.
 */
export function trackABConversion(experiment: string, goal: string): void {
  const variant = abExposures.get(experiment)
  if (!variant) return // No exposure recorded; skip
  trackEvent({ type: 'ab_conversion', timestamp: Date.now(), experiment, variant, goal })
}

// ---------------------------------------------------------------------------
// User properties
// ---------------------------------------------------------------------------

let currentUserProperties: Partial<UserProperties> = {}

/**
 * Set user-level properties for enriching analytics context.
 * No PII — use anonymous IDs and aggregate metrics only.
 */
export function setUserProperties(props: Partial<UserProperties>): void {
  currentUserProperties = { ...currentUserProperties, ...props }
}

export function getUserProperties(): Partial<UserProperties> {
  return { ...currentUserProperties }
}

// ---------------------------------------------------------------------------
// Performance tracking
// ---------------------------------------------------------------------------

/**
 * Track a named performance metric.
 */
export function trackPerformance(metric: string, value: number, unit: string = 'ms'): void {
  trackEvent({ type: 'performance', timestamp: Date.now(), metric, value, unit })
}

/**
 * Track Core Web Vitals for a route.
 */
export function trackPageLoad(
  route: string,
  metrics: { ttfbMs: number; lcpMs?: number; fidMs?: number; clsScore?: number }
): void {
  trackEvent({ type: 'page_load', timestamp: Date.now(), route, ...metrics })
}

/**
 * Track interaction delay (INP proxy).
 */
export function trackInteractionDelay(element: string, delayMs: number): void {
  if (delayMs < 50) return // Only record noticeable delays
  trackEvent({ type: 'interaction_delay', timestamp: Date.now(), element, delayMs })
}

// ---------------------------------------------------------------------------
// Error tracking
// ---------------------------------------------------------------------------

/**
 * Track an error, forwarding to both local log and Sentry.
 */
export function trackError(error: Error | string, context?: string): void {
  const message = typeof error === 'string' ? error : error.message
  const stack = typeof error === 'object' ? error.stack : undefined
  trackEvent({ type: 'error', timestamp: Date.now(), message, stack, context })

  if (typeof error === 'string') {
    Sentry.captureMessage(error, { extra: { context } })
  } else {
    Sentry.captureException(error, { extra: { context } })
  }
}

/**
 * Get error summary for monitoring dashboards.
 */
export function getErrorSummary(events: AnalyticsEvent[]): {
  totalErrors: number
  uniqueErrors: number
  topErrors: { message: string; count: number }[]
} {
  const errors = events.filter((e) => e.type === 'error') as Extract<AnalyticsEvent, { type: 'error' }>[]
  const counts: Record<string, number> = {}
  for (const e of errors) {
    counts[e.message] = (counts[e.message] ?? 0) + 1
  }
  const topErrors = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([message, count]) => ({ message, count }))

  return { totalErrors: errors.length, uniqueErrors: Object.keys(counts).length, topErrors }
}

// ---------------------------------------------------------------------------
// Funnel analysis
// ---------------------------------------------------------------------------

/**
 * Analyze the full onboarding → discovery → venue → check-in → pulse funnel.
 */
export function analyzeOnboardingFunnel(events: AnalyticsEvent[]): FunnelAnalysis {
  const appOpens = events.filter((e) => e.type === 'app_open').length
  const onboardingStarts = events.filter((e) => e.type === 'onboarding_start').length
  const onboardingCompletes = events.filter((e) => e.type === 'onboarding_complete').length
  const venueViews = events.filter((e) => e.type === 'venue_view').length
  const checkIns = events.filter((e) => e.type === 'checkin_complete').length
  const pulseSubmits = events.filter((e) => e.type === 'pulse_submit').length

  const makeFunnelStep = (name: string, count: number, prevCount: number): FunnelStep => ({
    name,
    count,
    dropoffRate: prevCount > 0 ? 1 - count / prevCount : 0,
  })

  const steps: FunnelStep[] = [
    { name: 'App Open', count: appOpens, dropoffRate: 0 },
    makeFunnelStep('Onboarding Start', onboardingStarts, appOpens),
    makeFunnelStep('Onboarding Complete', onboardingCompletes, onboardingStarts),
    makeFunnelStep('Venue View', venueViews, onboardingCompletes),
    makeFunnelStep('Check-in', checkIns, venueViews),
    makeFunnelStep('Pulse Submit', pulseSubmits, checkIns),
  ]

  return {
    name: 'Onboarding → First Pulse Funnel',
    steps,
    totalConversionRate: appOpens > 0 ? pulseSubmits / appOpens : 0,
    totalUsers: appOpens,
  }
}

// ---------------------------------------------------------------------------
// Core loop metrics
// ---------------------------------------------------------------------------

/**
 * Analyze core loop: open → venue view → pulse → discovery.
 */
export function analyzeCoreLoop(events: AnalyticsEvent[]): CoreLoopMetrics {
  const sessions = events.filter((e) => e.type === 'app_open').length || 1
  const venueViews = events.filter((e) => e.type === 'venue_view').length
  const pulses = events.filter((e) => e.type === 'pulse_submit').length
  const reactions = events.filter((e) => e.type === 'pulse_reaction').length
  const discoveries = events.filter((e) => e.type === 'venue_discovery').length

  const loopComplete = venueViews > 0 && pulses > 0 && discoveries > 0

  return {
    sessionsCount: sessions,
    venueViewsPerSession: venueViews / sessions,
    pulsesPerSession: pulses / sessions,
    reactionsPerSession: reactions / sessions,
    discoveryActionsPerSession: discoveries / sessions,
    coreLoopCompletionRate: loopComplete ? 1 : 0,
  }
}

// ---------------------------------------------------------------------------
// Social conversion
// ---------------------------------------------------------------------------

/**
 * Analyze social conversion: friend add → pulse creation within 24 hours.
 */
export function analyzeSocialConversion(events: AnalyticsEvent[]): SocialConversionMetrics {
  const friendAdds = events.filter(
    (e): e is Extract<AnalyticsEvent, { type: 'friend_add' }> => e.type === 'friend_add'
  )

  if (friendAdds.length === 0) {
    return { friendAdds: 0, usersWithFriendAdds: 0, usersWithFriendAddThenPulse: 0, conversionRate: 0 }
  }

  const pulseTimes = events
    .filter((e): e is Extract<AnalyticsEvent, { type: 'pulse_submit' }> => e.type === 'pulse_submit')
    .map((e) => e.timestamp)
    .sort((a, b) => a - b)

  const conversionWindowMs = 24 * 60 * 60 * 1_000
  let converted = 0
  for (const addEvent of friendAdds) {
    const hasPulseAfterAdd = pulseTimes.some(
      (t) => t >= addEvent.timestamp && t <= addEvent.timestamp + conversionWindowMs
    )
    if (hasPulseAfterAdd) converted++
  }

  return {
    friendAdds: friendAdds.length,
    usersWithFriendAdds: friendAdds.length,
    usersWithFriendAddThenPulse: converted,
    conversionRate: friendAdds.length > 0 ? converted / friendAdds.length : 0,
  }
}

// ---------------------------------------------------------------------------
// Seeded content metrics
// ---------------------------------------------------------------------------

export function analyzeSeededContent(
  seededVenues: { id: string; seeded: boolean; firstRealCheckInAt?: string; createdAt: string }[],
  seededHashtags: { name: string; seeded: boolean; verifiedUsageCount: number }[]
): SeededContentMetrics {
  const total = seededVenues.filter((v) => v.seeded).length
  const withActivity = seededVenues.filter((v) => v.seeded && v.firstRealCheckInAt).length

  const timesToFirst = seededVenues
    .filter((v) => v.seeded && v.firstRealCheckInAt)
    .map((v) => new Date(v.firstRealCheckInAt!).getTime() - new Date(v.createdAt).getTime())

  const avgTimeToFirst =
    timesToFirst.length > 0 ? timesToFirst.reduce((a, b) => a + b, 0) / timesToFirst.length : 0

  const seededTags = seededHashtags.filter((h) => h.seeded)
  const convertedTags = seededTags.filter((h) => h.verifiedUsageCount > 0)

  return {
    totalSeededVenues: total,
    seededWithRealActivity: withActivity,
    conversionRate: total > 0 ? withActivity / total : 0,
    averageTimeToFirstActivity: avgTimeToFirst,
    seededHashtagConversionRate: seededTags.length > 0 ? convertedTags.length / seededTags.length : 0,
  }
}

// ---------------------------------------------------------------------------
// Retention cohort
// ---------------------------------------------------------------------------

/**
 * Calculate 7-day retention for a cohort of users.
 */
export function calculateRetention(
  cohortUsers: { userId: string; joinDate: string }[],
  activityLog: { userId: string; timestamp: number }[]
): RetentionCohort {
  const cohortDate = cohortUsers[0]?.joinDate ?? new Date().toISOString()
  const userSet = new Set(cohortUsers.map((u) => u.userId))
  const day = 24 * 60 * 60 * 1_000
  const retainedByDay: Record<number, number> = {}

  for (let d = 1; d <= 7; d++) {
    const dayStart = new Date(cohortDate).getTime() + d * day
    const dayEnd = dayStart + day
    const activeUsers = new Set(
      activityLog
        .filter((a) => userSet.has(a.userId) && a.timestamp >= dayStart && a.timestamp < dayEnd)
        .map((a) => a.userId)
    )
    retainedByDay[d] = activeUsers.size
  }

  return { cohortDate, totalUsers: cohortUsers.length, retainedByDay }
}

// ---------------------------------------------------------------------------
// Integration action summary
// ---------------------------------------------------------------------------

export function getIntegrationActionSummary(events: AnalyticsEvent[]): IntegrationActionSummary {
  const integrationEvents = events.filter(
    (e): e is Extract<AnalyticsEvent, { type: 'integration_action' }> => e.type === 'integration_action'
  )

  const actionsByType: IntegrationActionSummary['actionsByType'] = {
    rideshare: 0,
    music: 0,
    reservation: 0,
    maps: 0,
    shortcuts: 0,
  }

  const providerCounts: Record<string, number> = {}

  for (const event of integrationEvents) {
    actionsByType[event.integrationType] += 1
    if (event.provider) {
      providerCounts[event.provider] = (providerCounts[event.provider] ?? 0) + 1
    }
  }

  return {
    totalActions: integrationEvents.length,
    successCount: integrationEvents.filter((e) => e.outcome === 'success').length,
    unavailableCount: integrationEvents.filter((e) => e.outcome === 'unavailable').length,
    failureCount: integrationEvents.filter((e) => e.outcome === 'failed').length,
    actionsByType,
    topProviders: Object.entries(providerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([provider, count]) => ({ provider, count })),
    recentFailures: integrationEvents
      .filter((e) => e.outcome !== 'success')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5),
  }
}
