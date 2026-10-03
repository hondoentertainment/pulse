/**
 * Guest → auth → first-pulse funnel (#92).
 * Exact event names from the issue. No PII in payloads.
 */

import { track, type EventProps } from './observability/analytics'

export const FUNNEL_EVENT_NAMES = [
  'guest_map_view',
  'venue_open',
  'auth_start',
  'first_pulse_create',
] as const

export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number]

const PII_KEYS = new Set([
  'userId',
  'email',
  'name',
  'phone',
  'displayName',
  'fullName',
  'username',
])

export function funnelActor(input: {
  hasSession: boolean
  isPlaceholder?: boolean
}): { guest: boolean } {
  return { guest: !input.hasSession && !input.isPlaceholder }
}

export function stripAnalyticsPii<T extends object>(props: T): T {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (PII_KEYS.has(key)) continue
    if (key === 'extra' && value && typeof value === 'object' && !Array.isArray(value)) {
      next.extra = stripAnalyticsPii(value)
      continue
    }
    next[key] = value
  }
  return next as unknown as T
}

export function trackFunnel<E extends FunnelEventName>(
  name: E,
  props: EventProps<E>,
): void {
  track(name, stripAnalyticsPii(props))
}
