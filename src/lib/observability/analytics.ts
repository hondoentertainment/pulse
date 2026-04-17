/**
 * Typed Product Analytics Client
 *
 * Single `track(event, props)` API with a central event registry so
 * every event name and its payload is typed at the call site.
 *
 * Backends are pluggable adapters. Out of the box we ship:
 *   - `noopAdapter` (default in test / SSR)
 *   - `consoleAdapter` (default in dev)
 *   - `amplitudeAdapter` (stub — env-gated, uses fetch HTTP API)
 *   - `posthogAdapter`  (stub — env-gated, uses fetch HTTP API)
 *
 * NO new runtime dependencies are added; the Amplitude / PostHog stubs
 * POST to their public HTTP endpoints using `fetch`.
 *
 * Adapter is resolved at module init from `VITE_ANALYTICS_BACKEND`:
 *   "amplitude" | "posthog" | "console" | "noop"
 *
 * The logger is wired in: every `track` call emits a debug log (so it
 * appears in Sentry breadcrumbs once the level is raised).
 */

import { logger } from './logger'

// ---------------------------------------------------------------------------
// Event Registry — add new events here and nowhere else.
// ---------------------------------------------------------------------------

/**
 * Shared properties every event may carry. Adapters may forward these
 * into provider-native "user properties" or "super properties".
 */
export interface BaseEventProps {
  userId?: string
  sessionId?: string
  route?: string
  /** Source surface: where the user was when the event fired. */
  source?: string
  /** Free-form extras. Must be JSON-serialisable. */
  extra?: Record<string, unknown>
}

export type OnboardingStep = 'welcome' | 'permissions' | 'profile' | 'first_follow' | 'done'

/**
 * Central event registry. Keyed by event name (string literal).
 * Value is the shape of that event's props (merged with BaseEventProps).
 *
 * IMPORTANT: changes here are a breaking contract for downstream
 * dashboards. Bump the `schema_version` in payloads if you rename
 * or remove fields.
 */
export interface EventRegistry {
  // --- Onboarding / activation -------------------------------------------
  onboarding_started: {
    method?: 'organic' | 'invite' | 'deeplink'
  }
  onboarding_completed: {
    durationMs?: number
    stepsCompleted?: OnboardingStep[]
  }

  // --- Core loop ---------------------------------------------------------
  pulse_created: {
    pulseId: string
    venueId: string
    hasPhoto?: boolean
    hasCaption?: boolean
    hashtagCount?: number
    energyRating?: string
    isFirstPulse?: boolean
  }
  pulse_viewed: {
    pulseId: string
    venueId?: string
    dwellMs?: number
    position?: number
    feed?: 'home' | 'venue' | 'friends' | 'trending'
  }
  reaction_added: {
    pulseId: string
    reactionType: string
  }

  // --- Venue ------------------------------------------------------------
  venue_viewed: {
    venueId: string
    source: 'map' | 'trending' | 'search' | 'notification' | 'deeplink' | 'friend_activity'
  }
  check_in_completed: {
    venueId: string
    method: 'manual' | 'auto_geofence' | 'qr'
    isFirstCheckIn?: boolean
  }

  // --- Discovery / growth -----------------------------------------------
  search_performed: {
    query: string
    resultCount: number
    /** Category of the search; keep cardinality low for dashboards. */
    kind: 'venue' | 'user' | 'hashtag' | 'global'
  }
  friend_added: {
    friendUserId: string
    method: 'qr' | 'search' | 'suggestion' | 'invite' | 'contacts'
  }

  // --- Engagement -------------------------------------------------------
  surge_notification_opened: {
    venueId: string
    /** Surge level at the moment the notification was dispatched. */
    surgeLevel?: 'rising' | 'hot' | 'peak'
    notificationId?: string
  }
}

export type EventName = keyof EventRegistry
export type EventProps<E extends EventName> = EventRegistry[E] & BaseEventProps

export interface TrackedEvent<E extends EventName = EventName> {
  name: E
  props: EventProps<E>
  timestamp: number
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface AnalyticsAdapter {
  name: string
  identify?(userId: string, traits?: Record<string, unknown>): void
  track(event: TrackedEvent): void
  /** Optional flush hook. Called on page hide / on demand. */
  flush?(): void
}

// ---------------------------------------------------------------------------
// Built-in adapters
// ---------------------------------------------------------------------------

export const noopAdapter: AnalyticsAdapter = {
  name: 'noop',
  track() {
    /* no-op */
  },
}

export const consoleAdapter: AnalyticsAdapter = {
  name: 'console',
  identify(userId, traits) {
    console.info('[analytics] identify', { userId, traits })
  },
  track(event) {
    console.info(`[analytics] ${event.name}`, event.props)
  },
}

// --- Amplitude stub ---------------------------------------------------------
// Uses the HTTP V2 endpoint: https://api2.amplitude.com/2/httpapi
// Gated on VITE_AMPLITUDE_API_KEY. If missing, falls back to no-op.
export function createAmplitudeAdapter(): AnalyticsAdapter {
  let apiKey: string | undefined
  try {
    apiKey = import.meta.env?.VITE_AMPLITUDE_API_KEY as string | undefined
  } catch {
    apiKey = undefined
  }
  const endpoint = 'https://api2.amplitude.com/2/httpapi'

  const post = (body: unknown) => {
    if (!apiKey) return
    try {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {
        /* swallow */
      })
    } catch {
      // ignore
    }
  }

  return {
    name: 'amplitude',
    identify(userId, traits) {
      post({
        api_key: apiKey,
        events: [
          {
            user_id: userId,
            event_type: '$identify',
            user_properties: traits ?? {},
            time: Date.now(),
          },
        ],
      })
    },
    track(event) {
      post({
        api_key: apiKey,
        events: [
          {
            user_id: event.props.userId,
            device_id: event.props.sessionId,
            event_type: event.name,
            event_properties: event.props,
            time: event.timestamp,
          },
        ],
      })
    },
  }
}

// --- PostHog stub -----------------------------------------------------------
// Uses the capture endpoint: https://app.posthog.com/capture/
// Gated on VITE_POSTHOG_API_KEY. If missing, falls back to no-op.
export function createPostHogAdapter(): AnalyticsAdapter {
  let apiKey: string | undefined
  let host: string | undefined
  try {
    apiKey = import.meta.env?.VITE_POSTHOG_API_KEY as string | undefined
    host = (import.meta.env?.VITE_POSTHOG_HOST as string | undefined) ?? 'https://app.posthog.com'
  } catch {
    apiKey = undefined
    host = 'https://app.posthog.com'
  }

  const post = (body: unknown) => {
    if (!apiKey) return
    try {
      void fetch(`${host}/capture/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {
        /* swallow */
      })
    } catch {
      // ignore
    }
  }

  return {
    name: 'posthog',
    identify(userId, traits) {
      post({
        api_key: apiKey,
        event: '$identify',
        distinct_id: userId,
        properties: { $set: traits ?? {} },
        timestamp: new Date().toISOString(),
      })
    },
    track(event) {
      post({
        api_key: apiKey,
        event: event.name,
        distinct_id: event.props.userId ?? event.props.sessionId ?? 'anonymous',
        properties: event.props,
        timestamp: new Date(event.timestamp).toISOString(),
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Adapter resolution
// ---------------------------------------------------------------------------

function resolveAdapter(): AnalyticsAdapter {
  let backend: string | undefined
  let isDev = false
  try {
    backend = import.meta.env?.VITE_ANALYTICS_BACKEND as string | undefined
    isDev = Boolean(import.meta.env?.DEV)
  } catch {
    // ignore
  }
  switch (backend) {
    case 'amplitude':
      return createAmplitudeAdapter()
    case 'posthog':
      return createPostHogAdapter()
    case 'console':
      return consoleAdapter
    case 'noop':
      return noopAdapter
    default:
      return isDev ? consoleAdapter : noopAdapter
  }
}

let currentAdapter: AnalyticsAdapter = resolveAdapter()

/** Swap the adapter at runtime (tests, feature flags). */
export function setAnalyticsAdapter(adapter: AnalyticsAdapter): void {
  currentAdapter = adapter
}
export function getAnalyticsAdapter(): AnalyticsAdapter {
  return currentAdapter
}

// ---------------------------------------------------------------------------
// Super properties (merged into every event)
// ---------------------------------------------------------------------------

const superProps: BaseEventProps = {}

export function setSuperProps(next: Partial<BaseEventProps>): void {
  Object.assign(superProps, next)
}
export function clearSuperProps(): void {
  for (const k of Object.keys(superProps)) {
    delete (superProps as Record<string, unknown>)[k]
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Type-safe event tracking.
 *
 * @example
 * track('pulse_created', { pulseId, venueId, hasPhoto: true })
 */
export function track<E extends EventName>(name: E, props: EventProps<E>): void {
  const merged = { ...superProps, ...props } as EventProps<E>
  const event: TrackedEvent<E> = {
    name,
    props: merged,
    timestamp: Date.now(),
  }
  try {
    currentAdapter.track(event)
  } catch {
    // Adapter errors must never bubble.
  }
  // Mirror into the structured logger so the event appears in
  // Sentry breadcrumbs and any configured HTTP log sink.
  logger.debug(`analytics:${name}`, {
    action: name,
    component: 'analytics',
    userId: merged.userId,
    sessionId: merged.sessionId,
    route: merged.route,
    extra: merged as unknown as Record<string, unknown>,
  })
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  setSuperProps({ userId })
  try {
    currentAdapter.identify?.(userId, traits)
  } catch {
    // ignore
  }
}

export function flushAnalytics(): void {
  try {
    currentAdapter.flush?.()
  } catch {
    // ignore
  }
}

/** List of every registered event name — useful for QA dashboards. */
export const REGISTERED_EVENTS: EventName[] = [
  'onboarding_started',
  'onboarding_completed',
  'pulse_created',
  'pulse_viewed',
  'reaction_added',
  'venue_viewed',
  'check_in_completed',
  'search_performed',
  'friend_added',
  'surge_notification_opened',
]
