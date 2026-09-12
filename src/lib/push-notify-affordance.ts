/**
 * Non-blocking nearby / followed-venue notify prompt.
 * Same chrome rules as InstallAffordance — never blocks browse.
 */

export const PUSH_NOTIFY_DISMISS_KEY = 'pulse_push_notify_affordance_v1'
export const PUSH_NOTIFY_TRIGGER_KEY = 'pulse_push_notify_trigger_v1'

export const PUSH_NOTIFY_AFFORDANCE_COPY = {
  headline: 'Get a ping when a followed venue pulses',
  body: 'Nearby live energy, even when Pulse is closed.',
  cta: 'Notify me',
  notNow: 'Not now',
  missingKeys: 'Push is not configured on this deploy — we will not pretend you were notified.',
} as const

export function shouldShowPushNotifyAffordance(input: {
  signedIn: boolean
  vapidPublicKey?: string | null
  dismissed?: boolean
  trigger: 'follow' | 'install' | 'none'
}): boolean {
  if (!input.signedIn || input.dismissed || input.trigger === 'none') return false
  // Show even without VAPID so the card can no-op honestly (never fake “notified”).
  return true
}

export function isPushNotifyDismissed(
  store: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): boolean {
  try {
    return store?.getItem(PUSH_NOTIFY_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissPushNotifyAffordance(
  store: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): void {
  try {
    store?.setItem(PUSH_NOTIFY_DISMISS_KEY, '1')
  } catch {
    /* ignore quota */
  }
}

export function offerPushNotifyAfter(
  trigger: 'follow' | 'install',
  store: Storage | null = typeof window === 'undefined' ? null : window.sessionStorage,
): void {
  try {
    store?.setItem(PUSH_NOTIFY_TRIGGER_KEY, trigger)
  } catch {
    /* ignore quota */
  }
}

export function readPushNotifyTrigger(
  store: Storage | null = typeof window === 'undefined' ? null : window.sessionStorage,
): 'follow' | 'install' | 'none' {
  try {
    const value = store?.getItem(PUSH_NOTIFY_TRIGGER_KEY)
    if (value === 'follow' || value === 'install') return value
  } catch {
    /* ignore */
  }
  return 'none'
}

export function clearPushNotifyTrigger(
  store: Storage | null = typeof window === 'undefined' ? null : window.sessionStorage,
): void {
  try {
    store?.removeItem(PUSH_NOTIFY_TRIGGER_KEY)
  } catch {
    /* ignore */
  }
}
