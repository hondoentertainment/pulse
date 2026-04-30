/**
 * useTrack — React hook wrapping the typed analytics client.
 *
 * Usage:
 *   const track = useTrack({ component: 'PulseComposer' })
 *   track('pulse_created', { pulseId, venueId })
 *
 * The hook:
 *  - auto-fills `route` from `window.location.pathname` on every call
 *  - auto-fills `sessionId` from the observability session
 *  - lets callers bind default props (e.g. `component`, `source`) once
 *  - is stable across re-renders (useCallback-wrapped)
 *  - never throws; failures are swallowed by the underlying adapter
 */

import { useCallback, useMemo } from 'react'
import {
  track as rawTrack,
  type BaseEventProps,
  type EventName,
  type EventProps,
} from '@/lib/observability/analytics'
import { getSessionId } from '@/lib/observability/logger'

export interface UseTrackOptions extends BaseEventProps {
  /** Human-readable component / surface name; becomes `source` when unset. */
  component?: string
}

export type TrackFn = <E extends EventName>(
  name: E,
  props: EventProps<E>
) => void

/**
 * Hook variant with bound defaults.
 *
 * @param defaults Props merged into every call (overridable per call).
 */
export function useTrack(defaults: UseTrackOptions = {}): TrackFn {
  // Memoise the defaults object so the returned callback is stable.
  const boundKey = useMemo(() => JSON.stringify(defaults), [defaults])

  return useCallback(
    <E extends EventName>(name: E, props: EventProps<E>) => {
      const route =
        typeof window !== 'undefined' && window.location
          ? window.location.pathname
          : undefined
      const sessionId = (() => {
        try {
          return getSessionId()
        } catch {
          return undefined
        }
      })()
      const source = props.source ?? defaults.component
      const merged = {
        sessionId,
        route,
        ...defaults,
        source,
        ...props,
        extra: { ...(defaults.extra ?? {}), ...(props.extra ?? {}) },
      } as EventProps<E>
      rawTrack(name, merged)
    },
    // boundKey is the stable representation of defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boundKey]
  )
}

/** Re-export for consumers that prefer to import everything from the hook module. */
export type { EventName, EventProps } from '@/lib/observability/analytics'
