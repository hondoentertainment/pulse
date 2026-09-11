/**
 * First-session cold start — Launch 33 first, All Seattle tip, fast map.
 */

export const COLD_START_TIP_STORAGE_KEY = 'pulse_cold_start_tip_v1'
export const COLD_START_HEADLINE = 'Where the energy is'
export const COLD_START_SUBLINE = 'Interactive map in under 2s · Launch 33 first'
export const ALL_SEATTLE_TIP = 'Tip: zoom out for All Seattle when you’re ready'
export const START_EXPLORING_LABEL = 'Start Exploring'

export function shouldShowColdStartTip(store: Storage | null = typeof window === 'undefined' ? null : window.localStorage): boolean {
  if (!store) return true
  try {
    return store.getItem(COLD_START_TIP_STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

export function dismissColdStartTip(store: Storage | null = typeof window === 'undefined' ? null : window.localStorage): void {
  try {
    store?.setItem(COLD_START_TIP_STORAGE_KEY, '1')
  } catch {
    /* ignore quota */
  }
}

/**
 * Cold-start measurement helper.
 *
 * How to measure (DevTools or `?debug=coldstart`):
 * 1. Hard reload `/` with Launch 33 default (All Seattle OSM stays filtered out).
 * 2. Look for Performance marks:
 *    - `pulse_nav_start` (or Navigation Timing `startTime`)
 *    - `pulse_map_interactive` when the map canvas first paints
 * 3. `measureColdStartMs()` returns that delta. Target: under ~2000ms feel
 *    on a mid phone. Heavy work (All Seattle clustering, surging rail) is
 *    deferred until after this mark.
 */
export const MAP_INTERACTIVE_MARK = 'pulse_map_interactive'
export const NAV_START_MARK = 'pulse_nav_start'
export const COLD_START_MEASURE = 'pulse_cold_start'

export function markNavigationStart(
  perf: Pick<Performance, 'mark'> | null = typeof performance === 'undefined' ? null : performance,
): void {
  try {
    perf?.mark(NAV_START_MARK)
  } catch {
    /* ignore */
  }
}

export function markMapInteractive(
  perf: Pick<Performance, 'mark' | 'measure' | 'getEntriesByName'> | null = typeof performance === 'undefined' ? null : performance,
): number | null {
  if (!perf) return null
  try {
    if (perf.getEntriesByName(MAP_INTERACTIVE_MARK).length > 0) {
      return readColdStartMs(perf)
    }
    perf.mark(MAP_INTERACTIVE_MARK)
    try {
      perf.measure(COLD_START_MEASURE, NAV_START_MARK, MAP_INTERACTIVE_MARK)
    } catch {
      try {
        perf.measure(COLD_START_MEASURE)
      } catch {
        /* Navigation Timing startTime is implicit */
      }
    }
    return readColdStartMs(perf)
  } catch {
    return null
  }
}

export function readColdStartMs(
  perf: Pick<Performance, 'getEntriesByName'> | null = typeof performance === 'undefined' ? null : performance,
): number | null {
  const measures = perf?.getEntriesByName(COLD_START_MEASURE) ?? []
  const last = measures[measures.length - 1]
  return last && Number.isFinite(last.duration) ? Math.round(last.duration) : null
}

export function formatColdStartDebug(ms: number | null): string {
  if (ms === null) return 'Cold start not measured'
  return `Map interactive in ${ms}ms (target <2000ms, Launch 33 default)`
}
