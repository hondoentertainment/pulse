/**
 * Ask the server to send the signed-in user’s I’m-here Web Push.
 * Missing session, VAPID, or network is a quiet no-op — the in-app toast still stands.
 */

import { supabase } from '@/lib/supabase'

export async function requestImHereGlance(input: {
  venueId: string
  venueName: string
}): Promise<void> {
  const venueId = input.venueId.trim()
  const venueName = input.venueName.trim()
  if (!venueId || !venueName) return
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const res = await fetch('/api/push/notify-im-here', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ venueId, venueName }),
    })
    if (!res.ok) {
      console.info('[im-here] glance not sent', res.status)
    }
  } catch (err) {
    console.info('[im-here] glance skipped', err)
  }
}
