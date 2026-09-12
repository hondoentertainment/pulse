/**
 * PWA Web Push subscribe / unsubscribe.
 * Missing VITE_VAPID_PUBLIC_KEY is an honest no-op — never fake “notified”.
 */

export const WEB_PUSH_SCOPE = 'followed_or_nearby' as const

export type WebPushClientResult =
  | { ok: true; subscription: PushSubscriptionJSON }
  | { ok: false; reason: 'missing_vapid' | 'denied' | 'unsupported' | 'persist' | 'unsubscribe_failed'; message: string }

export const WEB_PUSH_COPY = {
  headline: 'Get a ping when a followed venue pulses',
  body: 'Nearby live energy, even when Pulse is closed. You can turn this off anytime.',
  cta: 'Notify me',
  notNow: 'Not now',
  missingKeys: 'Push is not configured on this deploy — we will not pretend you were notified.',
  denied: 'Notifications are blocked in this browser.',
} as const

export function readViteVapidPublicKey(
  env: { VITE_VAPID_PUBLIC_KEY?: string } = (import.meta as { env?: { VITE_VAPID_PUBLIC_KEY?: string } }).env ?? {},
): string | null {
  const key = env.VITE_VAPID_PUBLIC_KEY?.trim()
  return key ? key : null
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export async function subscribeWebPush(deps: {
  vapidPublicKey?: string | null
  requestPermission?: () => Promise<NotificationPermission>
  getRegistration?: () => Promise<ServiceWorkerRegistration | null>
  persist?: (subscription: PushSubscriptionJSON) => Promise<void>
  notificationSupported?: boolean
  serviceWorkerSupported?: boolean
} = {}): Promise<WebPushClientResult> {
  const vapid = deps.vapidPublicKey === undefined ? readViteVapidPublicKey() : deps.vapidPublicKey
  if (!vapid) {
    return { ok: false, reason: 'missing_vapid', message: WEB_PUSH_COPY.missingKeys }
  }

  const notificationSupported = deps.notificationSupported
    ?? (typeof Notification !== 'undefined')
  const serviceWorkerSupported = deps.serviceWorkerSupported
    ?? (typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
  if (!notificationSupported || !serviceWorkerSupported) {
    return { ok: false, reason: 'unsupported', message: 'This browser cannot receive Web Push.' }
  }

  const requestPermission = deps.requestPermission
    ?? (() => Notification.requestPermission())
  const permission = await requestPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied', message: WEB_PUSH_COPY.denied }
  }

  const getRegistration = deps.getRegistration
    ?? (async () => ('serviceWorker' in navigator ? navigator.serviceWorker.ready : null))
  const registration = await getRegistration()
  if (!registration) {
    return { ok: false, reason: 'unsupported', message: 'This browser cannot receive Web Push.' }
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    })
    const json = subscription.toJSON()
    if (deps.persist) await deps.persist(json)
    return { ok: true, subscription: json }
  } catch (err) {
    return {
      ok: false,
      reason: 'persist',
      message: err instanceof Error ? err.message : 'Could not subscribe to push',
    }
  }
}

export async function unsubscribeWebPush(deps: {
  getRegistration?: () => Promise<ServiceWorkerRegistration | null>
  remove?: (endpoint: string) => Promise<void>
} = {}): Promise<WebPushClientResult> {
  const getRegistration = deps.getRegistration
    ?? (async () => ('serviceWorker' in navigator ? navigator.serviceWorker.ready : null))
  const registration = await getRegistration()
  if (!registration) {
    return { ok: false, reason: 'unsupported', message: 'This browser cannot receive Web Push.' }
  }
  try {
    const existing = await registration.pushManager.getSubscription()
    if (!existing) {
      return { ok: true, subscription: {} }
    }
    const endpoint = existing.endpoint
    await existing.unsubscribe()
    if (deps.remove && endpoint) await deps.remove(endpoint)
    return { ok: true, subscription: { endpoint } }
  } catch (err) {
    return {
      ok: false,
      reason: 'unsubscribe_failed',
      message: err instanceof Error ? err.message : 'Could not unsubscribe',
    }
  }
}
