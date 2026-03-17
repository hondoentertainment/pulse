/**
 * Analytics & Observability Engine
 *
 * Event tracking for core loop, funnel analysis,
 * seeded content analytics, and error monitoring.
 */

export type AnalyticsEvent =
  | { type: 'app_open'; timestamp: number }
  | { type: 'onboarding_start'; timestamp: number }
  | { type: 'onboarding_complete'; timestamp: number; durationMs: number }
  | { type: 'venue_view'; timestamp: number; venueId: string; source: 'map' | 'trending' | 'search' | 'notification' | 'deeplink' }
  | { type: 'pulse_start'; timestamp: number; venueId: string }
  | { type: 'pulse_submit'; timestamp: number; venueId: string; energyRating: string; hasPhoto: boolean; hasCaption: boolean; hashtagCount: number }
  | { type: 'pulse_reaction'; timestamp: number; pulseId: string; reactionType: string }
  | { type: 'venue_discovery'; timestamp: number; venueId: string; method: 'trending' | 'map' | 'search' | 'friend_activity' }
  | { type: 'share'; timestamp: number; contentType: 'venue' | 'pulse' | 'invite'; method: 'native' | 'clipboard' | 'story' }
  | { type: 'friend_add'; timestamp: number; method: 'qr' | 'search' | 'suggestion' | 'invite' }
  | { type: 'integration_action'; timestamp: number; venueId: string; integrationType: 'rideshare' | 'music' | 'reservation' | 'maps' | 'shortcuts'; actionId: string; provider?: string; outcome: 'success' | 'unavailable' | 'failed'; reason?: string }
  | { type: 'event_rsvp'; timestamp: number; eventId: string; status: string }
  | { type: 'error'; timestamp: number; message: string; stack?: string; context?: string }
  | { type: 'performance'; timestamp: number; metric: string; value: number; unit: string }
  // --- Product analytics events ---
  | { type: 'activation_first_pulse'; timestamp: number; userId: string; venueId: string; timeSinceSignupMs: number }
  | { type: 'retention_weekly_active'; timestamp: number; userId: string; weekNumber: number }
  | { type: 'engagement_pulses_per_session'; timestamp: number; sessionId: string; count: number }
  | { type: 'engagement_venues_viewed'; timestamp: number; sessionId: string; count: number }
  | { type: 'engagement_checkins_completed'; timestamp: number; sessionId: string; count: number }
  | { type: 'funnel_step'; timestamp: number; funnel: string; step: 'app_open' | 'venue_view' | 'check_in' | 'pulse_creation'; sessionId: string }
  | { type: 'session_start'; timestamp: number; sessionId: string }
  | { type: 'session_end'; timestamp: number; sessionId: string; durationMs: number }

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

const eventLog: AnalyticsEvent[] = []
const MAX_EVENTS = 10000

/**
 * Track an analytics event.
 */
export function trackEvent(event: AnalyticsEvent): void {
  eventLog.push(event)
  if (eventLog.length > MAX_EVENTS) {
    eventLog.splice(0, eventLog.length - MAX_EVENTS)
  }
}

/**
 * Get all tracked events, optionally filtered by type.
 */
export function getEvents(type?: AnalyticsEvent['type']): AnalyticsEvent[] {
  if (!type) return [...eventLog]
  return eventLog.filter(e => e.type === type)
}

/**
 * Clear all events.
 */
export function clearEvents(): void {
  eventLog.length = 0
}

export function getIntegrationActionSummary(events: AnalyticsEvent[]): IntegrationActionSummary {
  const integrationEvents = events.filter(
    (event): event is Extract<AnalyticsEvent, { type: 'integration_action' }> => event.type === 'integration_action'
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
    successCount: integrationEvents.filter(event => event.outcome === 'success').length,
    unavailableCount: integrationEvents.filter(event => event.outcome === 'unavailable').length,
    failureCount: integrationEvents.filter(event => event.outcome === 'failed').length,
    actionsByType,
    topProviders: Object.entries(providerCounts)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 5)
      .map(([provider, count]) => ({ provider, count })),
    recentFailures: integrationEvents
      .filter(event => event.outcome !== 'success')
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 5),
  }
}

/**
 * Analyze onboarding funnel.
 */
export function analyzeOnboardingFunnel(events: AnalyticsEvent[]): FunnelAnalysis {
  const appOpens = events.filter(e => e.type === 'app_open').length
  const onboardingStarts = events.filter(e => e.type === 'onboarding_start').length
  const onboardingCompletes = events.filter(e => e.type === 'onboarding_complete').length
  const firstPulse = new Set(
    events.filter(e => e.type === 'pulse_submit').map(e => 'venueId' in e ? e.venueId : '')
  ).size > 0 ? Math.min(appOpens, events.filter(e => e.type === 'pulse_submit').length) : 0

  const steps: FunnelStep[] = [
    { name: 'App Open', count: appOpens, dropoffRate: 0 },
    { name: 'Onboarding Start', count: onboardingStarts, dropoffRate: appOpens > 0 ? 1 - onboardingStarts / appOpens : 0 },
    { name: 'Onboarding Complete', count: onboardingCompletes, dropoffRate: onboardingStarts > 0 ? 1 - onboardingCompletes / onboardingStarts : 0 },
    { name: 'First Pulse', count: firstPulse, dropoffRate: onboardingCompletes > 0 ? 1 - firstPulse / onboardingCompletes : 0 },
  ]

  return {
    name: 'Onboarding Funnel',
    steps,
    totalConversionRate: appOpens > 0 ? firstPulse / appOpens : 0,
    totalUsers: appOpens,
  }
}

/**
 * Analyze core loop metrics.
 * Core loop: open -> venue view -> pulse -> discovery
 */
export function analyzeCoreLoop(events: AnalyticsEvent[]): CoreLoopMetrics {
  const sessions = events.filter(e => e.type === 'app_open').length || 1
  const venueViews = events.filter(e => e.type === 'venue_view').length
  const pulses = events.filter(e => e.type === 'pulse_submit').length
  const reactions = events.filter(e => e.type === 'pulse_reaction').length
  const discoveries = events.filter(e => e.type === 'venue_discovery').length

  // Core loop complete = at least one of each step in a session
  const hasVenueView = venueViews > 0
  const hasPulse = pulses > 0
  const hasDiscovery = discoveries > 0
  const loopComplete = hasVenueView && hasPulse && hasDiscovery

  return {
    sessionsCount: sessions,
    venueViewsPerSession: venueViews / sessions,
    pulsesPerSession: pulses / sessions,
    reactionsPerSession: reactions / sessions,
    discoveryActionsPerSession: discoveries / sessions,
    coreLoopCompletionRate: loopComplete ? 1 : 0,
  }
}

/**
 * Analyze seeded content performance.
 */
export function analyzeSeededContent(
  seededVenues: { id: string; seeded: boolean; firstRealCheckInAt?: string; createdAt: string }[],
  seededHashtags: { name: string; seeded: boolean; verifiedUsageCount: number }[]
): SeededContentMetrics {
  const total = seededVenues.filter(v => v.seeded).length
  const withActivity = seededVenues.filter(v => v.seeded && v.firstRealCheckInAt).length

  const timesToFirst = seededVenues
    .filter(v => v.seeded && v.firstRealCheckInAt)
    .map(v => new Date(v.firstRealCheckInAt!).getTime() - new Date(v.createdAt).getTime())

  const avgTimeToFirst = timesToFirst.length > 0
    ? timesToFirst.reduce((a, b) => a + b, 0) / timesToFirst.length
    : 0

  const seededTags = seededHashtags.filter(h => h.seeded)
  const convertedTags = seededTags.filter(h => h.verifiedUsageCount > 0)

  return {
    totalSeededVenues: total,
    seededWithRealActivity: withActivity,
    conversionRate: total > 0 ? withActivity / total : 0,
    averageTimeToFirstActivity: avgTimeToFirst,
    seededHashtagConversionRate: seededTags.length > 0 ? convertedTags.length / seededTags.length : 0,
  }
}

/**
 * Calculate 7-day retention for a cohort.
 */
export function calculateRetention(
  cohortUsers: { userId: string; joinDate: string }[],
  activityLog: { userId: string; timestamp: number }[]
): RetentionCohort {
  const cohortDate = cohortUsers[0]?.joinDate ?? new Date().toISOString()
  const userSet = new Set(cohortUsers.map(u => u.userId))
  const day = 24 * 60 * 60 * 1000
  const retainedByDay: Record<number, number> = {}

  for (let d = 1; d <= 7; d++) {
    const dayStart = new Date(cohortDate).getTime() + d * day
    const dayEnd = dayStart + day
    const activeUsers = new Set(
      activityLog
        .filter(a => userSet.has(a.userId) && a.timestamp >= dayStart && a.timestamp < dayEnd)
        .map(a => a.userId)
    )
    retainedByDay[d] = activeUsers.size
  }

  return {
    cohortDate,
    totalUsers: cohortUsers.length,
    retainedByDay,
  }
}

/**
 * Track a performance metric.
 */
export function trackPerformance(metric: string, value: number, unit: string = 'ms'): void {
  trackEvent({
    type: 'performance',
    timestamp: Date.now(),
    metric,
    value,
    unit,
  })
}

/**
 * Track an error.
 */
export function trackError(error: Error | string, context?: string): void {
  const message = typeof error === 'string' ? error : error.message
  const stack = typeof error === 'object' ? error.stack : undefined
  trackEvent({
    type: 'error',
    timestamp: Date.now(),
    message,
    stack,
    context,
  })
}

/**
 * Get error summary for monitoring.
 */
export function getErrorSummary(events: AnalyticsEvent[]): {
  totalErrors: number
  uniqueErrors: number
  topErrors: { message: string; count: number }[]
} {
  const errors = events.filter(e => e.type === 'error') as Extract<AnalyticsEvent, { type: 'error' }>[]
  const counts: Record<string, number> = {}
  for (const e of errors) {
    counts[e.message] = (counts[e.message] ?? 0) + 1
  }
  const topErrors = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([message, count]) => ({ message, count }))

  return {
    totalErrors: errors.length,
    uniqueErrors: Object.keys(counts).length,
    topErrors,
  }
}

// ===========================================================================
// Product Analytics — Activation, Retention, Engagement, Funnels, Sessions
// ===========================================================================

let currentSessionId: string | null = null
let sessionStartTimestamp: number | null = null
let sessionPulseCount = 0
let sessionVenueViewCount = 0
let sessionCheckinCount = 0

/**
 * Generate a short unique session ID.
 */
function makeSessionId(): string {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Start a new analytics session.  Call on app open / foreground.
 */
export function startSession(): string {
  const sessionId = makeSessionId()
  currentSessionId = sessionId
  sessionStartTimestamp = Date.now()
  sessionPulseCount = 0
  sessionVenueViewCount = 0
  sessionCheckinCount = 0

  trackEvent({ type: 'session_start', timestamp: Date.now(), sessionId })
  return sessionId
}

/**
 * End the current session, emitting engagement roll-ups and duration.
 */
export function endSession(): void {
  if (!currentSessionId || !sessionStartTimestamp) return

  const durationMs = Date.now() - sessionStartTimestamp
  const sessionId = currentSessionId

  trackEvent({ type: 'session_end', timestamp: Date.now(), sessionId, durationMs })
  trackEvent({ type: 'engagement_pulses_per_session', timestamp: Date.now(), sessionId, count: sessionPulseCount })
  trackEvent({ type: 'engagement_venues_viewed', timestamp: Date.now(), sessionId, count: sessionVenueViewCount })
  trackEvent({ type: 'engagement_checkins_completed', timestamp: Date.now(), sessionId, count: sessionCheckinCount })

  currentSessionId = null
  sessionStartTimestamp = null
}

/**
 * Get the active session ID (if any).
 */
export function getSessionId(): string | null {
  return currentSessionId
}

/**
 * Track an activation event: user created their very first pulse.
 */
export function trackActivation(userId: string, venueId: string, signupTimestamp: number): void {
  trackEvent({
    type: 'activation_first_pulse',
    timestamp: Date.now(),
    userId,
    venueId,
    timeSinceSignupMs: Date.now() - signupTimestamp,
  })
}

/**
 * Track a weekly-active retention ping.
 * Call once per calendar week per user (guard externally).
 */
export function trackWeeklyActive(userId: string): void {
  const weekNumber = getISOWeekNumber(new Date())
  trackEvent({
    type: 'retention_weekly_active',
    timestamp: Date.now(),
    userId,
    weekNumber,
  })
}

/**
 * Record that the user viewed a venue during this session (for engagement).
 */
export function recordSessionVenueView(): void {
  sessionVenueViewCount++
}

/**
 * Record that the user submitted a pulse during this session (for engagement).
 */
export function recordSessionPulse(): void {
  sessionPulseCount++
}

/**
 * Record that the user completed a check-in during this session.
 */
export function recordSessionCheckin(): void {
  sessionCheckinCount++
}

// ---------------------------------------------------------------------------
// Funnel tracking: app open -> venue view -> check-in -> pulse creation
// ---------------------------------------------------------------------------

const funnelProgress = new Set<string>()

/**
 * Track a step in the core conversion funnel.
 * Duplicate steps within the same session are ignored.
 */
export function trackFunnelStep(step: 'app_open' | 'venue_view' | 'check_in' | 'pulse_creation'): void {
  if (!currentSessionId) return
  const key = `${currentSessionId}:${step}`
  if (funnelProgress.has(key)) return
  funnelProgress.add(key)

  trackEvent({
    type: 'funnel_step',
    timestamp: Date.now(),
    funnel: 'core_conversion',
    step,
    sessionId: currentSessionId,
  })
}

/**
 * Analyze the core conversion funnel from recorded funnel_step events.
 */
export function analyzeCoreConversionFunnel(events: AnalyticsEvent[]): FunnelAnalysis {
  const funnelEvents = events.filter(
    (e): e is Extract<AnalyticsEvent, { type: 'funnel_step' }> =>
      e.type === 'funnel_step' && ('funnel' in e) && e.funnel === 'core_conversion'
  )

  const stepOrder: ('app_open' | 'venue_view' | 'check_in' | 'pulse_creation')[] = [
    'app_open', 'venue_view', 'check_in', 'pulse_creation',
  ]

  const sessionsByStep: Record<string, Set<string>> = {}
  for (const step of stepOrder) {
    sessionsByStep[step] = new Set()
  }
  for (const e of funnelEvents) {
    sessionsByStep[e.step]?.add(e.sessionId)
  }

  const counts = stepOrder.map(s => sessionsByStep[s].size)
  const steps: FunnelStep[] = stepOrder.map((name, i) => ({
    name,
    count: counts[i],
    dropoffRate: i === 0 ? 0 : counts[i - 1] > 0 ? 1 - counts[i] / counts[i - 1] : 0,
  }))

  return {
    name: 'Core Conversion Funnel',
    steps,
    totalConversionRate: counts[0] > 0 ? counts[counts.length - 1] / counts[0] : 0,
    totalUsers: counts[0],
  }
}

/**
 * Compute session-duration statistics from recorded session events.
 */
export function getSessionDurationStats(events: AnalyticsEvent[]): {
  totalSessions: number
  averageDurationMs: number
  medianDurationMs: number
  p95DurationMs: number
} {
  const endEvents = events.filter(
    (e): e is Extract<AnalyticsEvent, { type: 'session_end' }> => e.type === 'session_end'
  )

  if (endEvents.length === 0) {
    return { totalSessions: 0, averageDurationMs: 0, medianDurationMs: 0, p95DurationMs: 0 }
  }

  const durations = endEvents.map(e => e.durationMs).sort((a, b) => a - b)
  const sum = durations.reduce((a, b) => a + b, 0)
  const mid = Math.floor(durations.length / 2)

  return {
    totalSessions: durations.length,
    averageDurationMs: sum / durations.length,
    medianDurationMs: durations.length % 2 === 0
      ? (durations[mid - 1] + durations[mid]) / 2
      : durations[mid],
    p95DurationMs: durations[Math.floor(durations.length * 0.95)] ?? durations[durations.length - 1],
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
