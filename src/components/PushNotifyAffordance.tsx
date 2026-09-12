import { useState } from 'react'
import {
  PUSH_NOTIFY_AFFORDANCE_COPY,
  dismissPushNotifyAffordance,
} from '@/lib/push-notify-affordance'
import { WEB_PUSH_COPY, readViteVapidPublicKey, subscribeWebPush } from '@/lib/web-push-client'
import { persistWebPushSubscription } from '@/lib/data/web-push-subscriptions'

interface PushNotifyAffordanceProps {
  onDone?: () => void
  userLocation?: { lat: number; lng: number } | null
}

export function PushNotifyAffordance({ onDone, userLocation }: PushNotifyAffordanceProps) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const vapid = readViteVapidPublicKey()

  const hide = () => {
    dismissPushNotifyAffordance()
    onDone?.()
  }

  if (!vapid) {
    return (
      <section className="rounded-xl border border-border bg-card p-3.5" aria-label="Live pulse notify">
        <h2 className="text-sm font-semibold text-foreground">{PUSH_NOTIFY_AFFORDANCE_COPY.headline}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{WEB_PUSH_COPY.missingKeys}</p>
        <button
          type="button"
          className="mt-3 h-10 rounded-full bg-muted px-3 text-sm font-semibold text-foreground"
          onClick={hide}
        >
          {PUSH_NOTIFY_AFFORDANCE_COPY.notNow}
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-3.5" aria-label="Live pulse notify">
      <h2 className="text-sm font-semibold text-foreground">{PUSH_NOTIFY_AFFORDANCE_COPY.headline}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{PUSH_NOTIFY_AFFORDANCE_COPY.body}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="h-10 flex-1 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void subscribeWebPush({
              vapidPublicKey: vapid,
              persist: async (subscription) => {
                await persistWebPushSubscription({
                  endpoint: subscription.endpoint ?? '',
                  keys: subscription.keys,
                  lat: userLocation?.lat ?? null,
                  lng: userLocation?.lng ?? null,
                })
              },
            }).then((result) => {
              if (!result.ok) {
                setNote(result.message)
                setBusy(false)
                return
              }
              hide()
            })
          }}
        >
          {PUSH_NOTIFY_AFFORDANCE_COPY.cta}
        </button>
        <button
          type="button"
          className="h-10 rounded-full bg-muted px-3 text-sm font-semibold text-foreground"
          onClick={hide}
        >
          {PUSH_NOTIFY_AFFORDANCE_COPY.notNow}
        </button>
      </div>
    </section>
  )
}
