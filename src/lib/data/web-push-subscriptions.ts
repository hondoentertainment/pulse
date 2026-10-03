/**
 * PWA Web Push subscriptions persist on existing `push_tokens`
 * (platform = 'web', token = endpoint). Owner-only RLS already on prod.
 * Do not use a second web_push_subscriptions table.
 */

import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { WEB_PUSH_SCOPE } from '@/lib/web-push-client'
import { readQuietHours, type QuietHours } from '@/lib/surge-prefs'

/** Inspected prod RLS — do not add a second policy set. */
export const PUSH_TOKENS_RLS = {
  table: 'push_tokens',
  select: 'auth.uid() = user_id',
  insert: 'auth.uid() = user_id',
  update: 'auth.uid() = user_id',
  delete: 'auth.uid() = user_id',
  webRow: "platform = 'web'",
  anon: 'no writes',
} as const

/** Inspected prod RLS — live-pulse fan-out inserts as service_role. */
export const NOTIFICATIONS_RLS = {
  table: 'notifications',
  select: 'auth.uid() = user_id OR is_admin()',
  insert: 'service_role only',
  update: 'auth.uid() = user_id OR is_admin()',
  delete: 'auth.uid() = user_id OR is_admin()',
  livePulseType: 'friend_pulse',
} as const

export interface PersistWebPushInput {
  endpoint: string
  keys?: { p256dh?: string; auth?: string }
  lat?: number | null
  lng?: number | null
  /** When omitted, quiet hours already saved on this device are copied onto the row. */
  quietHours?: QuietHours | null
}

export async function persistWebPushSubscription(input: PersistWebPushInput): Promise<void> {
  const userId = await requireUserId({ action: 'save a push subscription' })
  const p256dh = input.keys?.p256dh
  const auth = input.keys?.auth
  if (!input.endpoint || !p256dh || !auth) {
    throw new Error('Push subscription is missing endpoint or keys')
  }
  const hours = input.quietHours === undefined ? readQuietHours() : input.quietHours
  const withQuiet = hours != null && hours.start != null && hours.end != null
  const base = {
    user_id: userId,
    token: input.endpoint,
    platform: 'web' as const,
    p256dh,
    auth,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    scope: WEB_PUSH_SCOPE,
    last_seen_at: new Date().toISOString(),
  }
  const row = withQuiet
    ? { ...base, quiet_hours_start: hours.start, quiet_hours_end: hours.end }
    : base
  const save = (payload: typeof row) => supabase.from('push_tokens').upsert(
    payload,
    { onConflict: 'user_id,token' },
  )
  let { error } = await save(row)
  if (error && withQuiet && /quiet_hours/i.test(error.message ?? '')) {
    const retry = await save(base)
    error = retry.error
  }
  if (error) {
    throw Object.assign(new Error(error.message), { cause: error })
  }
}

export async function removeWebPushSubscription(endpoint: string): Promise<void> {
  const userId = await requireUserId({ action: 'remove a push subscription' })
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', endpoint)
    .eq('platform', 'web')
  if (error) {
    throw Object.assign(new Error(error.message), { cause: error })
  }
}
