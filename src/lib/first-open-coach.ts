/**
 * One-line first-session coach on the map. Does not block the map.
 */

export const FIRST_OPEN_COACH_STORAGE_KEY = 'pulse_first_open_coach_v1'
export const FIRST_OPEN_COACH_LINE =
  'What’s live tonight is on Tonight. Find a room, then I’m here · Pulse.'
export const FIRST_OPEN_COACH_DISMISS = 'Got it'

export function shouldShowFirstOpenCoach(
  store: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): boolean {
  if (!store) return true
  try {
    return store.getItem(FIRST_OPEN_COACH_STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

export function dismissFirstOpenCoach(
  store: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): void {
  try {
    store?.setItem(FIRST_OPEN_COACH_STORAGE_KEY, '1')
  } catch {
    /* ignore quota */
  }
}
