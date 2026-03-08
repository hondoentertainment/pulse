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
  | { type: 'event_rsvp'; timestamp: number; eventId: string; status: string }
  | { type: 'error'; timestamp: number; message: string; stack?: string; context?: string }
  | { type: 'performance'; timestamp: number; metric: string; value: number; unit: string }

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
