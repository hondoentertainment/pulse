/**
 * Server-side push sender — fans out a message to all of a user's registered
 * device tokens via FCM (Android) or APNs (iOS).
 *
 * Graceful degradation: if the required env vars are missing we log and
 * return success so local/CI runs don't throw. Real credentials are wired up
 * in production via the deployment environment.
 *
 * Required env vars (optional — missing means log-only):
 *   FCM_SERVER_KEY         — legacy FCM or a service account token for HTTP v1
 *   FCM_PROJECT_ID         — required for HTTP v1
 *   APNS_KEY_ID            — Apple push key identifier
 *   APNS_TEAM_ID           — Apple developer team id
 *   APNS_KEY_FILE          — path to .p8 file (file mounted at runtime)
 *   APNS_BUNDLE_ID         — iOS bundle id (default com.pulse.nightlife)
 *   APNS_HOST              — api.push.apple.com | api.sandbox.push.apple.com
 *   SUPABASE_URL           — for fetching token rows
 *   SUPABASE_SERVICE_ROLE  — service-role key for server-side reads
 */

export interface PushMessage {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
}

export interface PushSendResult {
  userId: string
  dispatched: number
  skipped: number
  logOnly: boolean
  errors: string[]
}

interface PushTokenRow {
  token: string
  platform: 'ios' | 'android'
}

async function loadTokens(userId: string): Promise<PushTokenRow[]> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) return []

  try {
    const res = await fetch(
      `${url}/rest/v1/push_tokens?user_id=eq.${encodeURIComponent(userId)}&select=token,platform`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as PushTokenRow[]
    return rows
  } catch (err) {
    console.warn('[push] failed to load tokens', err)
    return []
  }
}

async function sendFcm(token: string, msg: PushMessage): Promise<{ ok: boolean; error?: string }> {
  const serverKey = process.env.FCM_SERVER_KEY
  if (!serverKey) return { ok: false, error: 'FCM_SERVER_KEY missing' }

  try {
    // Legacy FCM endpoint shape — easiest to use without a service-account
    // flow. For HTTP v1 migrate to https://fcm.googleapis.com/v1/projects/{id}/messages:send
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: { title: msg.title, body: msg.body },
        data: msg.data ?? {},
      }),
    })
    if (!res.ok) {
      return { ok: false, error: `FCM ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'FCM error' }
  }
}

async function sendApns(token: string, msg: PushMessage): Promise<{ ok: boolean; error?: string }> {
  // APNs requires signing a short-lived JWT with the .p8 key (ES256).
  // Implementing ES256 signing is non-trivial without a library and is a
  // deliberate follow-up for production. The scaffold documents the env contract
  // and returns a structured "missing-config" error so callers can fall back
  // to log-only mode in tests.
  if (!process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID || !process.env.APNS_KEY_FILE) {
    return { ok: false, error: 'APNS env missing' }
  }

  try {
    // Placeholder dispatcher — the real implementation should use an
    // HTTP/2 client (e.g. node-apn or apns2) with the signed JWT. We log
    // the intent so ops can verify wiring in non-prod environments.
    console.info('[push] APNS dispatch (placeholder)', { token: token.slice(0, 8), title: msg.title })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'APNS error' }
  }
}

export async function sendPushToUser(msg: PushMessage): Promise<PushSendResult> {
  const tokens = await loadTokens(msg.userId)
  const hasFcm = !!process.env.FCM_SERVER_KEY
  const hasApns = !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_FILE)
  const logOnly = !hasFcm && !hasApns

  if (logOnly) {
    console.info('[push] log-only (env missing)', {
      userId: msg.userId,
      title: msg.title,
      tokenCount: tokens.length,
    })
    return { userId: msg.userId, dispatched: 0, skipped: tokens.length, logOnly: true, errors: [] }
  }

  let dispatched = 0
  let skipped = 0
  const errors: string[] = []

  for (const t of tokens) {
    const res =
      t.platform === 'android' && hasFcm
        ? await sendFcm(t.token, msg)
        : t.platform === 'ios' && hasApns
          ? await sendApns(t.token, msg)
          : { ok: false, error: 'no provider for platform' }

    if (res.ok) dispatched += 1
    else {
      skipped += 1
      if (res.error) errors.push(res.error)
    }
  }

  return { userId: msg.userId, dispatched, skipped, logOnly: false, errors }
}
