/**
 * Web Push fan-out for Signal reminders.
 *
 * Loads endpoints from `signal_push_subscriptions` and sends via the
 * `web-push` library when VAPID keys are configured. Missing keys stay
 * log-only so local/CI runs do not throw.
 */
import type { PushMessage, PushSendResult } from './push'

export interface WebPushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

export type WebPushDeliverer = (
  subscription: WebPushSubscriptionRow,
  payload: string,
) => Promise<{ ok: boolean; error?: string }>

async function loadWebPushSubscriptions(userId: string): Promise<WebPushSubscriptionRow[]> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) return []

  try {
    const res = await fetch(
      `${url}/rest/v1/signal_push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=endpoint,p256dh,auth`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    )
    if (!res.ok) return []
    return (await res.json()) as WebPushSubscriptionRow[]
  } catch (err) {
    console.warn('[web-push] failed to load subscriptions', err)
    return []
  }
}

export function createWebPushDeliverer(): WebPushDeliverer | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null

  return async (subscription, payload) => {
    const webpush = (await import('web-push')).default
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:signal@pulse.app',
      publicKey,
      privateKey,
    )
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      )
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'web-push error' }
    }
  }
}

const BLOCKED_PUSH_KEYS = new Set([
  'energy',
  'mood',
  'stress',
  'sleep',
  'sleepQuality',
  'sleep_quality',
  'score',
  'tags',
  'focus',
])

export function sanitizeSignalPushData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data ?? {})) {
    if (!BLOCKED_PUSH_KEYS.has(key)) clean[key] = value
  }
  return clean
}

export function buildWebPushPayload(msg: PushMessage): string {
  return JSON.stringify({
    title: msg.title,
    body: msg.body,
    data: sanitizeSignalPushData(msg.data as Record<string, unknown> | undefined),
  })
}

export function notificationOpenUrl(data: Record<string, unknown> | undefined): string {
  if (typeof data?.url === 'string' && data.url.startsWith('/')) return data.url
  if (data?.kind === 'signal_reminder') return '/home'
  return '/'
}

export async function sendWebPushToUser(
  msg: PushMessage,
  deliver: WebPushDeliverer | null | undefined = undefined,
): Promise<PushSendResult> {
  const subscriptions = await loadWebPushSubscriptions(msg.userId)
  const sender = deliver === undefined ? createWebPushDeliverer() : deliver
  const payload = buildWebPushPayload(msg)

  if (!sender) {
    console.info('[web-push] log-only (VAPID env missing)', {
      userId: msg.userId,
      title: msg.title,
      subscriptionCount: subscriptions.length,
    })
    return {
      userId: msg.userId,
      dispatched: 0,
      skipped: subscriptions.length,
      logOnly: true,
      errors: [],
    }
  }

  const deliveries = await Promise.all(subscriptions.map(async (subscription) => {
    const result = await sender(subscription, payload)
    return result
  }))

  const dispatched = deliveries.filter((result) => result.ok).length
  const skipped = deliveries.length - dispatched
  const errors = deliveries.flatMap((result) => (result.ok || !result.error ? [] : [result.error]))

  return { userId: msg.userId, dispatched, skipped, logOnly: false, errors }
}
