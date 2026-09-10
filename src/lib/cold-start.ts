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
