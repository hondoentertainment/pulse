/**
 * Fan-out a user-targeted notification to every delivery channel we support:
 *
 *   1. Supabase Realtime broadcast (`sendPush` in notify.ts) — in-app safety
 *      alerts for clients listening on `safety-alerts:<userId>`.
 *   2. Native device push (`sendPushToUser` in push.ts) — FCM HTTP v1 /
 *      APNs for registered iOS/Android tokens.
 *
 * Callers should treat a partial success as acceptable: realtime may succeed
 * while native is log-only (missing FCM/APNs env), or vice versa.
 */

import { sendPush, type NotifyDeps } from './notify'
import { sendPushToUser, type PushDeps } from './push'

export interface DispatchNotificationInput {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
}

export interface DispatchNotificationResult {
  realtime: Awaited<ReturnType<typeof sendPush>>
  native: Awaited<ReturnType<typeof sendPushToUser>>
}

export async function dispatchUserNotification(
  input: DispatchNotificationInput,
  deps?: { notify?: NotifyDeps; push?: PushDeps },
): Promise<DispatchNotificationResult> {
  const [realtime, native] = await Promise.all([
    sendPush(
      {
        userId: input.userId,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
      },
      deps?.notify,
    ),
    sendPushToUser(
      {
        userId: input.userId,
        title: input.title,
        body: input.body,
        data: input.data,
      },
      deps?.push,
    ),
  ])
  return { realtime, native }
}
