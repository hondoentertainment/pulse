import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth/require-auth'
import { WEB_PUSH_SCOPE } from '@/lib/web-push-client'

export interface PersistWebPushInput {
  endpoint: string
  keys?: { p256dh?: string; auth?: string }
  lat?: number | null
  lng?: number | null
}

export async function persistWebPushSubscription(input: PersistWebPushInput): Promise<void> {
  const userId = await requireUserId({ action: 'save a push subscription' })
  const p256dh = input.keys?.p256dh
  const auth = input.keys?.auth
  if (!input.endpoint || !p256dh || !auth) {
    throw new Error('Push subscription is missing endpoint or keys')
  }
  const { error } = await supabase.from('web_push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      p256dh,
      auth,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      scope: WEB_PUSH_SCOPE,
    },
    { onConflict: 'user_id,endpoint' },
  )
  if (error) {
    throw Object.assign(new Error(error.message), { cause: error })
  }
}

export async function removeWebPushSubscription(endpoint: string): Promise<void> {
  const userId = await requireUserId({ action: 'remove a push subscription' })
  const { error } = await supabase
    .from('web_push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
  if (error) {
    throw Object.assign(new Error(error.message), { cause: error })
  }
}
