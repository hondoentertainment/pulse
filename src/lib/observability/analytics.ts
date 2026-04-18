/**
 * Typed analytics client for Pulse.
 *
 * This is the canonical event-tracking surface used by UI components. It
 * wraps the legacy discriminated-union event system in `src/lib/analytics.ts`
 * and also broadcasts to Vercel Analytics. Consumers should import `track`
 * and `identify` from this module (or use the `useTrack` React hook).
 *
 * The `EventRegistry` below is the source-of-truth for event names and
 * property shapes. Adding a new event:
 *   1. Add an entry to `EventRegistry`.
 *   2. Call `track('new_event', { ... })` from a component.
 *
 * TypeScript will enforce the property shape at call sites.
 */

import { track as vercelTrack } from '@vercel/analytics'
import { trackEvent } from '@/lib/analytics'
import { logger } from './logger'

// ─── Event registry ──────────────────────────────────────────────────────────

export interface EventRegistry {
  onboarding_started: { method: 'organic' | 'referral' | 'deeplink' }
  onboarding_completed: { durationMs: number; stepsCompleted: number }
  pulse_created: {
    pulseId: string
    venueId: string
    hasPhoto: boolean
    hashtagCount: number
    energyRating: string
    isFirstPulse: boolean
  }
  pulse_viewed: {
    pulseId: string
    feed: string
    position: number
    dwellMs: number
  }
  reaction_added: {
    pulseId: string
    reactionType: 'fire' | 'eyes' | 'skull' | 'lightning'
  }
  venue_viewed: { venueId: string; source: string }
  check_in_completed: {
    venueId: string
    method: 'manual' | 'auto' | 'crew'
    isFirstCheckIn: boolean
  }
  search_performed: {
    query: string
    resultCount: number
    kind: 'venue' | 'global' | 'hashtag' | 'user'
  }
  friend_added: {
    friendUserId: string
    method: 'qr' | 'search' | 'suggestion' | 'invite'
  }
  surge_notification_opened: {
    venueId: string
    surgeScore?: number
  }
}

export type EventName = keyof EventRegistry
export type EventProps<E extends EventName> = EventRegistry[E]

// ─── Identity state ──────────────────────────────────────────────────────────

let currentUserId: string | null = null
let currentUserProps: Record<string, unknown> = {}

/**
 * Associate subsequent events with a user. Call with `null` on sign-out.
 */
export function identify(
  userId: string | null,
  props?: { email?: string; createdAt?: string; [key: string]: unknown },
): void {
  currentUserId = userId
  currentUserProps = userId ? { ...(props ?? {}) } : {}
  logger.child({ component: 'analytics' }).info('identify', {
    userId,
    hasProps: Boolean(props && Object.keys(props).length),
  })
}

/**
 * Returns the current identified user id, or null when anonymous.
 */
export function getCurrentUserId(): string | null {
  return currentUserId
}

// ─── Track ───────────────────────────────────────────────────────────────────

/**
 * Emit a typed analytics event. Properties are enforced against EventRegistry.
 */
export function track<E extends EventName>(event: E, props: EventProps<E>): void {
  const payload: Record<string, unknown> = {
    ...(props as Record<string, unknown>),
    ...(currentUserId ? { userId: currentUserId } : {}),
    ...(currentUserProps ? { _userProps: currentUserProps } : {}),
  }

  try {
    vercelTrack(event, payload as Parameters<typeof vercelTrack>[1])
  } catch (err) {
    logger.child({ component: 'analytics' }).warn('vercel track failed', { err: String(err) })
  }

  // Bridge to legacy analytics for funnel/retention analysis where a
  // corresponding type already exists.
  bridgeToLegacy(event, props)
}

function bridgeToLegacy<E extends EventName>(event: E, props: EventProps<E>): void {
  const now = Date.now()
  switch (event) {
    case 'onboarding_started':
      trackEvent({ type: 'onboarding_start', timestamp: now })
      break
    case 'onboarding_completed': {
      const { durationMs } = props as EventProps<'onboarding_completed'>
      trackEvent({ type: 'onboarding_complete', timestamp: now, durationMs })
      break
    }
    case 'pulse_created': {
      const p = props as EventProps<'pulse_created'>
      trackEvent({
        type: 'pulse_submit',
        timestamp: now,
        venueId: p.venueId,
        energyRating: p.energyRating,
        hasPhoto: p.hasPhoto,
        hasCaption: false,
        hashtagCount: p.hashtagCount,
      })
      break
    }
    case 'reaction_added': {
      const p = props as EventProps<'reaction_added'>
      trackEvent({
        type: 'pulse_reaction',
        timestamp: now,
        pulseId: p.pulseId,
        reactionType: p.reactionType,
      })
      break
    }
    case 'venue_viewed': {
      const p = props as EventProps<'venue_viewed'>
      const legacySource = normaliseVenueSource(p.source)
      trackEvent({
        type: 'venue_view',
        timestamp: now,
        venueId: p.venueId,
        source: legacySource,
      })
      break
    }
    case 'friend_added': {
      const p = props as EventProps<'friend_added'>
      trackEvent({ type: 'friend_add', timestamp: now, method: p.method })
      break
    }
    default:
      // No legacy bridge for this event; Vercel path is sufficient.
      break
  }
}

function normaliseVenueSource(
  source: string,
): 'map' | 'trending' | 'search' | 'notification' | 'deeplink' {
  switch (source) {
    case 'map':
    case 'trending':
    case 'search':
    case 'notification':
    case 'deeplink':
      return source
    default:
      return 'deeplink'
  }
}
