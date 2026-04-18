/**
 * React hook wrapping the typed analytics client.
 *
 * Keeps the `track` function reference stable across renders so it can be
 * used safely inside effects without causing re-runs.
 */

import { useCallback } from 'react'
import {
  track as trackImpl,
  type EventName,
  type EventProps,
} from '@/lib/observability/analytics'

export function useTrack(): <E extends EventName>(event: E, props: EventProps<E>) => void {
  return useCallback(<E extends EventName>(event: E, props: EventProps<E>) => {
    trackImpl(event, props)
  }, [])
}
