/**
 * Server-side push sender — fans out a message to all of a user's registered
 * device tokens via FCM HTTP v1 (Android) or APNs over HTTP/2 (iOS).
 *
 * Design goals:
 *   - **No third-party deps.** Token minting (OAuth2 / APNs JWT) is implemented
 *     with `node:crypto`; transport uses `fetch` (FCM) and `node:http2` (APNs).
 *   - **Graceful degradation.** If the required env vars are missing we log and
 *     return a `logOnly` result so local/CI runs never throw or hit the network.
 *   - **Testability.** All side effects (env, fetch, APNs transport, clock) are
 *     injectable via the optional `deps` arg, and the JWT builders are exported
 *     as pure functions.
 *
 * Env vars (all optional — missing means that provider is skipped):
 *   FCM HTTP v1 (Android / FCM-routed iOS):
 *     FCM_PROJECT_ID        — Firebase project id
 *     FCM_CLIENT_EMAIL      — service-account client_email
 *     FCM_PRIVATE_KEY       — service-account private_key (PEM, \n-escaped ok)
 *   APNs (native iOS):
 *     APNS_KEY_ID           — Apple push key identifier (kid)
 *     APNS_TEAM_ID          — Apple developer team id (iss)
 *     APNS_PRIVATE_KEY      — .p8 contents (PEM, \n-escaped ok) — preferred
 *     APNS_BUNDLE_ID        — iOS bundle id (apns-topic; default com.pulse.nightlife)
 *     APNS_HOST             — api.push.apple.com (default) | api.sandbox.push.apple.com
 *   Token store:
 *     SUPABASE_URL          — for fetching token rows
 *     SUPABASE_SERVICE_ROLE / SUPABASE_SERVICE_ROLE_KEY — service-role key
 */

import { createSign } from 'node:crypto'

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

type SendAttemptResult = { ok: boolean; error?: string; staleToken?: boolean }

export interface PushEnv {
  FCM_PROJECT_ID?: string
  FCM_CLIENT_EMAIL?: string
  FCM_PRIVATE_KEY?: string
  APNS_KEY_ID?: string
  APNS_TEAM_ID?: string
  APNS_PRIVATE_KEY?: string
  APNS_BUNDLE_ID?: string
  APNS_HOST?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    ok: boolean
    status: number
    text: () => Promise<string>
    json: () => Promise<unknown>
  }>
}

/** Minimal APNs transport result. */
export interface ApnsResponse {
  status: number
  body: string
}

/** Sends a single APNs request. Injectable so tests avoid real HTTP/2. */
export type ApnsTransport = (args: {
  host: string
  path: string
  headers: Record<string, string>
  body: string
}) => Promise<ApnsResponse>

type LoggerLike = {
  info: (msg: string, meta?: Record<string, unknown>) => void
  warn: (msg: string, meta?: Record<string, unknown>) => void
  error: (msg: string, meta?: Record<string, unknown>) => void
}

export interface PushDeps {
  env?: PushEnv
  fetch?: FetchLike
  apnsTransport?: ApnsTransport
  logger?: LoggerLike
  /** Current time in ms — injectable for deterministic JWT claims/cache tests. */
  now?: () => number
}

const defaultLogger: LoggerLike = {
  info: (msg, meta) => console.info(`[push] ${msg}`, meta ?? {}),
  warn: (msg, meta) => console.warn(`[push] ${msg}`, meta ?? {}),
  error: (msg, meta) => console.error(`[push] ${msg}`, meta ?? {}),
}

function readEnv(explicit?: PushEnv): PushEnv {
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  return {
    FCM_PROJECT_ID: explicit?.FCM_PROJECT_ID ?? p.FCM_PROJECT_ID,
    FCM_CLIENT_EMAIL: explicit?.FCM_CLIENT_EMAIL ?? p.FCM_CLIENT_EMAIL,
    FCM_PRIVATE_KEY: explicit?.FCM_PRIVATE_KEY ?? p.FCM_PRIVATE_KEY,
    APNS_KEY_ID: explicit?.APNS_KEY_ID ?? p.APNS_KEY_ID,
    APNS_TEAM_ID: explicit?.APNS_TEAM_ID ?? p.APNS_TEAM_ID,
    APNS_PRIVATE_KEY: explicit?.APNS_PRIVATE_KEY ?? p.APNS_PRIVATE_KEY,
    APNS_BUNDLE_ID: explicit?.APNS_BUNDLE_ID ?? p.APNS_BUNDLE_ID,
    APNS_HOST: explicit?.APNS_HOST ?? p.APNS_HOST,
    SUPABASE_URL: explicit?.SUPABASE_URL ?? p.SUPABASE_URL ?? p.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE: explicit?.SUPABASE_SERVICE_ROLE ?? p.SUPABASE_SERVICE_ROLE,
    SUPABASE_SERVICE_ROLE_KEY: explicit?.SUPABASE_SERVICE_ROLE_KEY ?? p.SUPABASE_SERVICE_ROLE_KEY,
  }
}

// ─── Encoding / crypto helpers (pure, exported for tests) ────────────────────

/** base64url-encode a string or Buffer (no padding). */
export function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** PEM keys are often stored with literal `\n` — normalise to real newlines. */
export function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem
}

/**
 * Build a signed APNs provider JWT (ES256). Pure: given the same inputs and
 * clock it produces a deterministic header/payload (signature varies per ECDSA
 * nonce but always verifies against the matching public key).
 */
export function buildApnsJwt(
  args: { keyId: string; teamId: string; privateKey: string },
  nowMs: number = Date.now(),
): string {
  const header = { alg: 'ES256', kid: args.keyId, typ: 'JWT' }
  const payload = { iss: args.teamId, iat: Math.floor(nowMs / 1000) }
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  // `ieee-p1363` yields the raw r||s encoding JOSE requires (not ASN.1/DER).
  const signature = createSign('SHA256')
    .update(signingInput)
    .sign({ key: normalizePem(args.privateKey), dsaEncoding: 'ieee-p1363' })
  return `${signingInput}.${base64url(signature)}`
}

/**
 * Build the RS256 assertion JWT used to exchange a Google service-account key
 * for an OAuth2 access token (FCM HTTP v1 scope).
 */
export function buildFcmAssertion(
  args: { clientEmail: string; privateKey: string },
  nowMs: number = Date.now(),
): string {
  const iat = Math.floor(nowMs / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: args.clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  }
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signature = createSign('RSA-SHA256').update(signingInput).sign(normalizePem(args.privateKey))
  return `${signingInput}.${base64url(signature)}`
}

// ─── Token store ─────────────────────────────────────────────────────────────

async function loadTokens(userId: string, env: PushEnv, fetchFn: FetchLike | undefined): Promise<PushTokenRow[]> {
  const url = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || !fetchFn) return []

  try {
    const res = await fetchFn(
      `${url.replace(/\/$/, '')}/rest/v1/push_tokens?user_id=eq.${encodeURIComponent(userId)}&select=token,platform`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) return []
    return (await res.json()) as PushTokenRow[]
  } catch {
    return []
  }
}

/** Returns true when the provider indicates the device token should be removed. */
export function isStalePushToken(platform: 'ios' | 'android', status: number, body: string): boolean {
  const normalized = body.toUpperCase()
  if (platform === 'ios') {
    return status === 410 || normalized.includes('BADDEVICETOKEN') || normalized.includes('UNREGISTERED')
  }
  return status === 404 || normalized.includes('UNREGISTERED') || normalized.includes('NOT_FOUND')
}

async function deleteToken(
  userId: string,
  token: string,
  env: PushEnv,
  fetchFn: FetchLike,
  logger: LoggerLike,
): Promise<void> {
  const url = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  try {
    const res = await fetchFn(
      `${url.replace(/\/$/, '')}/rest/v1/push_tokens?user_id=eq.${encodeURIComponent(userId)}&token=eq.${encodeURIComponent(token)}`,
      { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      logger.warn('stale token delete failed', { userId, status: res.status, body: text.slice(0, 120) })
    }
  } catch (err) {
    logger.warn('stale token delete threw', { userId, error: err instanceof Error ? err.message : String(err) })
  }
}

// ─── FCM HTTP v1 ─────────────────────────────────────────────────────────────

interface FcmTokenCache {
  accessToken: string
  expiresAtMs: number
}

let fcmTokenCache: FcmTokenCache | null = null

/** Test seam: reset the in-memory FCM access-token cache. */
export function __resetFcmTokenCache(): void {
  fcmTokenCache = null
}

async function getFcmAccessToken(
  env: PushEnv,
  fetchFn: FetchLike,
  nowMs: number,
): Promise<string | null> {
  if (!env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) return null
  if (fcmTokenCache && fcmTokenCache.expiresAtMs > nowMs + 60_000) {
    return fcmTokenCache.accessToken
  }

  const assertion = buildFcmAssertion(
    { clientEmail: env.FCM_CLIENT_EMAIL, privateKey: env.FCM_PRIVATE_KEY },
    nowMs,
  )
  const res = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}` +
      `&assertion=${encodeURIComponent(assertion)}`,
  })
  if (!res.ok) return null
  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) return null

  fcmTokenCache = {
    accessToken: json.access_token,
    expiresAtMs: nowMs + (json.expires_in ?? 3600) * 1000,
  }
  return json.access_token
}

async function sendViaFcm(
  token: string,
  msg: PushMessage,
  accessToken: string,
  projectId: string,
  fetchFn: FetchLike,
): Promise<SendAttemptResult> {
  try {
    const res = await fetchFn(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: msg.data ?? {},
        },
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        error: `FCM ${res.status}: ${text.slice(0, 200)}`,
        staleToken: isStalePushToken('android', res.status, text),
      }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'FCM error' }
  }
}

// ─── APNs (HTTP/2) ───────────────────────────────────────────────────────────

/**
 * Default APNs transport using Node's built-in HTTP/2 client. Opens a
 * short-lived connection per call — acceptable for low/moderate volume and
 * keeps the function stateless. Never throws; surfaces failures as a 0 status.
 */
const defaultApnsTransport: ApnsTransport = async ({ host, path, headers, body }) => {
  const http2 = await import('node:http2')
  return new Promise<ApnsResponse>((resolve) => {
    let settled = false
    const finish = (r: ApnsResponse) => {
      if (settled) return
      settled = true
      resolve(r)
    }

    let client: import('node:http2').ClientHttp2Session | null = null
    try {
      client = http2.connect(`https://${host}`)
    } catch (err) {
      finish({ status: 0, body: err instanceof Error ? err.message : 'connect-failed' })
      return
    }

    client.on('error', (err) => finish({ status: 0, body: err.message }))

    const req = client.request({ ':method': 'POST', ':path': path, ...headers })
    let status = 0
    let data = ''
    req.on('response', (resHeaders) => {
      status = Number(resHeaders[':status']) || 0
    })
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      finish({ status, body: data })
      client?.close()
    })
    req.on('error', (err) => {
      finish({ status: 0, body: err.message })
      client?.close()
    })
    // Safety timeout so a stalled connection never hangs the function.
    req.setTimeout(10_000, () => {
      finish({ status: 0, body: 'apns-timeout' })
      req.close()
      client?.close()
    })

    req.end(body)
  })
}

async function sendViaApns(
  token: string,
  msg: PushMessage,
  env: PushEnv,
  jwt: string,
  transport: ApnsTransport,
): Promise<SendAttemptResult> {
  const host = env.APNS_HOST || 'api.push.apple.com'
  const topic = env.APNS_BUNDLE_ID || 'com.pulse.nightlife'
  const payload = JSON.stringify({
    aps: { alert: { title: msg.title, body: msg.body }, sound: 'default' },
    ...(msg.data ?? {}),
  })

  try {
    const res = await transport({
      host,
      path: `/3/device/${token}`,
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
      },
      body: payload,
    })
    if (res.status === 200) return { ok: true }
    return {
      ok: false,
      error: `APNS ${res.status}: ${res.body.slice(0, 200)}`,
      staleToken: isStalePushToken('ios', res.status, res.body),
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'APNS error' }
  }
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export async function sendPushToUser(msg: PushMessage, deps: PushDeps = {}): Promise<PushSendResult> {
  const env = readEnv(deps.env)
  const logger = deps.logger ?? defaultLogger
  const fetchFn: FetchLike | undefined = deps.fetch ?? (globalThis as { fetch?: FetchLike }).fetch
  const apnsTransport = deps.apnsTransport ?? defaultApnsTransport
  const nowMs = (deps.now ?? Date.now)()

  const hasFcm = !!(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY)
  const hasApns = !!(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY)

  const tokens = await loadTokens(msg.userId, env, fetchFn)

  if (!hasFcm && !hasApns) {
    logger.info('log-only (no provider configured)', {
      userId: msg.userId,
      title: msg.title,
      tokenCount: tokens.length,
    })
    return { userId: msg.userId, dispatched: 0, skipped: tokens.length, logOnly: true, errors: [] }
  }

  // Mint provider credentials once per fan-out.
  const fcmAccessToken =
    hasFcm && fetchFn ? await getFcmAccessToken(env, fetchFn, nowMs) : null
  const apnsJwt = hasApns
    ? buildApnsJwt(
        { keyId: env.APNS_KEY_ID!, teamId: env.APNS_TEAM_ID!, privateKey: env.APNS_PRIVATE_KEY! },
        nowMs,
      )
    : null

  let dispatched = 0
  let skipped = 0
  const errors: string[] = []

  for (const t of tokens) {
    let result: SendAttemptResult

    if (t.platform === 'android' && fcmAccessToken && fetchFn) {
      result = await sendViaFcm(t.token, msg, fcmAccessToken, env.FCM_PROJECT_ID!, fetchFn)
    } else if (t.platform === 'ios' && apnsJwt) {
      result = await sendViaApns(t.token, msg, env, apnsJwt, apnsTransport)
    } else {
      result = { ok: false, error: `no provider for platform "${t.platform}"` }
    }

    if (result.ok) {
      dispatched += 1
    } else {
      skipped += 1
      if (result.error) errors.push(result.error)
      if (result.staleToken && fetchFn) {
        await deleteToken(msg.userId, t.token, env, fetchFn, logger)
      }
    }
  }

  if (errors.length > 0) {
    logger.warn('some pushes failed', { userId: msg.userId, dispatched, skipped, errors })
  }

  return { userId: msg.userId, dispatched, skipped, logOnly: false, errors }
}
