/**
 * PRD §8.1 decision analytics — north-star: Decision Conversion Rate.
 */

import { trackEvent } from '@/lib/analytics'
import type { EnergyRating } from '@/lib/types'
import type { VibeFilter } from '@/lib/tonight-feed'

let activeSessionId: string | null = null
let sessionStartedAt = 0

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function startDecisionSession(): string {
  activeSessionId = newSessionId()
  sessionStartedAt = Date.now()
  trackEvent({
    type: 'decision_session_start',
    timestamp: sessionStartedAt,
    sessionId: activeSessionId,
  })
  return activeSessionId
}

export function getActiveDecisionSessionId(): string | null {
  return activeSessionId
}

export function trackVibeSelected(vibe: VibeFilter): void {
  trackEvent({
    type: 'vibe_selected',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    vibe,
  })
}

export function trackRecommendationViewed(venueId: string, rank: number, confidence: string): void {
  trackEvent({
    type: 'recommendation_viewed',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    venueId,
    rank,
    confidence,
    source: 'tonight',
  })
}

export function trackExplanationExpanded(venueId: string): void {
  trackEvent({
    type: 'explanation_expanded',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    venueId,
  })
}

export function trackGoSelected(venueId: string): void {
  trackEvent({
    type: 'go_selected',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    venueId,
  })
}

export function trackDirectionsStarted(venueId: string): void {
  trackEvent({
    type: 'directions_started',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    venueId,
  })
}

export function trackVenueSaved(venueId: string): void {
  trackEvent({
    type: 'venue_saved',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    venueId,
  })
}

export function trackVenueShared(venueId: string, method: 'native' | 'clipboard'): void {
  trackEvent({
    type: 'venue_shared',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    venueId,
    method,
  })
}

export function trackArrivalConfirmed(venueId: string): void {
  trackEvent({
    type: 'arrival_confirmed',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    venueId,
  })
}

export function trackMismatchReported(venueId: string, displayedEnergy: EnergyRating): void {
  trackEvent({
    type: 'mismatch_reported',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    venueId,
    displayedEnergy,
  })
}

export function trackFilterApplied(filter: string): void {
  trackEvent({
    type: 'filter_applied',
    timestamp: Date.now(),
    sessionId: activeSessionId ?? undefined,
    filter,
  })
}

const DECISION_EVENTS = new Set([
  'go_selected',
  'directions_started',
  'venue_saved',
  'venue_shared',
  'arrival_confirmed',
])

export function isDecisionConversionEvent(type: string): boolean {
  return DECISION_EVENTS.has(type)
}

export function analyzeDecisionConversion(
  events: Array<{ type: string; timestamp: number; sessionId?: string }>,
): { qualifiedSessions: number; conversions: number; rate: number } {
  const sessions = new Set(
    events.filter((e) => e.type === 'decision_session_start').map((e) => e.sessionId).filter(Boolean),
  )
  const qualified = sessions.size
  const convertedSessions = new Set<string>()
  for (const event of events) {
    if (!event.sessionId || !DECISION_EVENTS.has(event.type)) continue
    convertedSessions.add(event.sessionId)
  }
  const conversions = convertedSessions.size
  return {
    qualifiedSessions: qualified,
    conversions,
    rate: qualified > 0 ? conversions / qualified : 0,
  }
}
