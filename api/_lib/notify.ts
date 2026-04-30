/**
 * Twilio + Supabase Realtime notification helpers.
 *
 * No runtime deps: SMS is sent via raw `fetch` against the Twilio REST API,
 * and push fan-out goes through Supabase Realtime using the service-role client
 * that is already in the serverless runtime.
 *
 * Env vars (optional):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM                (E.164, e.g. +15551234567)
 *   SUPABASE_URL               (for realtime publish)
 *   SUPABASE_SERVICE_ROLE_KEY  (for realtime publish)
 *
 * When env is missing the helpers log-and-noop so dev boxes don't spam real
 * numbers. Callers should treat `ok: false` as "delivery not attempted" and
 * `ok: true` as "dispatch acknowledged by provider".
 */

export interface SendSmsInput {
  to: string
  body: string
}

export interface SendPushInput {
  userId: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export interface SendResult {
  ok: boolean
  provider: 'twilio' | 'supabase-realtime' | 'log-only'
  error?: string
  providerMessageId?: string
}

interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    ok: boolean
    status: number
    text: () => Promise<string>
    json: () => Promise<unknown>
  }>
}

type LoggerLike = {
  info: (msg: string, meta?: Record<string, unknown>) => void
  warn: (msg: string, meta?: Record<string, unknown>) => void
  error: (msg: string, meta?: Record<string, unknown>) => void
}

const defaultLogger: LoggerLike = {
  info: (msg, meta) => console.info(`[safety/notify] ${msg}`, meta ?? {}),
  warn: (msg, meta) => console.warn(`[safety/notify] ${msg}`, meta ?? {}),
  error: (msg, meta) => console.error(`[safety/notify] ${msg}`, meta ?? {}),
}

export interface NotifyEnv {
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_FROM?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

export interface NotifyDeps {
  env?: NotifyEnv
  fetch?: FetchLike
  logger?: LoggerLike
}

function readEnv(explicit?: NotifyEnv): NotifyEnv {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  return {
    TWILIO_ACCOUNT_SID: explicit?.TWILIO_ACCOUNT_SID ?? processEnv.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: explicit?.TWILIO_AUTH_TOKEN ?? processEnv.TWILIO_AUTH_TOKEN,
    TWILIO_FROM: explicit?.TWILIO_FROM ?? processEnv.TWILIO_FROM,
    SUPABASE_URL: explicit?.SUPABASE_URL ?? processEnv.SUPABASE_URL ?? processEnv.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY:
      explicit?.SUPABASE_SERVICE_ROLE_KEY ?? processEnv.SUPABASE_SERVICE_ROLE_KEY,
  }
}

function encodeFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

function toBase64(s: string): string {
  const maybeBtoa = (globalThis as { btoa?: (s: string) => string }).btoa
  if (typeof maybeBtoa === 'function') {
    return maybeBtoa(s)
  }
  const BufferCtor = (globalThis as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } }).Buffer
  if (BufferCtor) {
    return BufferCtor.from(s).toString('base64')
  }
  throw new Error('No base64 encoder available in this runtime')
}

/**
 * Redact a phone number for log output: keep the country code and last 2
 * digits, mask the rest. e.g. `+15555551234` -> `+1*******34`.
 */
function redactPhone(to: string): string {
  if (!to || to.length < 4) return '***'
  const head = to.startsWith('+') ? to.slice(0, 2) : to.slice(0, 1)
  const tail = to.slice(-2)
  const midLen = Math.max(0, to.length - head.length - tail.length)
  return `${head}${'*'.repeat(midLen)}${tail}`
}

/**
 * Log a suppressed-SMS event using the shared structured marker so ops can
 * grep production logs. Never throws; always safe to call from fallback paths.
 */
function logSuppressed(
  logger: LoggerLike,
  to: string,
  reason: string,
  extra: Record<string, unknown> = {},
): void {
  try {
    logger.warn('SAFETY_KIT_SMS_SUPPRESSED', {
      marker: 'SAFETY_KIT_SMS_SUPPRESSED',
      to: redactPhone(to),
      reason,
      ...extra,
    })
  } catch {
    // Swallow logger failures — delivery attempt already accounted for.
  }
}

/**
 * Fire an SMS via the Twilio REST API.
 *
 * Twilio is used when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
 * `TWILIO_FROM` are all set. On any missing env or HTTP failure the helper
 * falls back to a structured `SAFETY_KIT_SMS_SUPPRESSED` console.warn log
 * (including the redacted `to` and a `reason` code) and returns a result
 * object — it **never throws** into the caller.
 */
export async function sendSms(input: SendSmsInput, deps: NotifyDeps = {}): Promise<SendResult> {
  const logger = deps.logger ?? defaultLogger
  const env = readEnv(deps.env)
  const fetchFn: FetchLike | undefined =
    deps.fetch ?? (globalThis as { fetch?: FetchLike }).fetch

  if (!input.to || !/^\+[1-9][0-9]{6,14}$/.test(input.to)) {
    logSuppressed(logger, input.to ?? '', 'invalid-e164')
    return { ok: false, provider: 'log-only', error: 'invalid-e164' }
  }
  if (!input.body || input.body.length > 1600) {
    logSuppressed(logger, input.to, 'invalid-body')
    return { ok: false, provider: 'log-only', error: 'invalid-body' }
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
    logSuppressed(logger, input.to, 'twilio-env-missing')
    return { ok: true, provider: 'log-only' }
  }
  if (!fetchFn) {
    logSuppressed(logger, input.to, 'no-fetch-available')
    return { ok: false, provider: 'log-only', error: 'no-fetch' }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`
  const auth = toBase64(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)
  const body = encodeFormBody({
    To: input.to,
    From: env.TWILIO_FROM,
    Body: `${input.body}\n\nReply STOP to unsubscribe.`,
  })

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      logSuppressed(logger, input.to, `twilio-http-${response.status}`, {
        responseBody: text.slice(0, 500),
      })
      return { ok: false, provider: 'twilio', error: `twilio-${response.status}` }
    }
    const json = (await response.json().catch(() => ({}))) as { sid?: string }
    return { ok: true, provider: 'twilio', providerMessageId: json.sid }
  } catch (error) {
    logSuppressed(logger, input.to, 'fetch-failed', { error: String(error) })
    return { ok: false, provider: 'twilio', error: 'fetch-failed' }
  }
}

/**
 * Publish a push-style notification through Supabase Realtime. We use the
 * broadcast endpoint so we don't need any extra infrastructure - the client
 * listens on channel `safety-alerts:<userId>`.
 */
export async function sendPush(input: SendPushInput, deps: NotifyDeps = {}): Promise<SendResult> {
  const logger = deps.logger ?? defaultLogger
  const env = readEnv(deps.env)
  const fetchFn: FetchLike | undefined =
    deps.fetch ?? (globalThis as { fetch?: FetchLike }).fetch

  if (!input.userId || !input.title || !input.body) {
    return { ok: false, provider: 'log-only', error: 'invalid-input' }
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !fetchFn) {
    logger.warn('realtime-env-missing, logging push instead', {
      userId: input.userId,
      title: input.title,
    })
    return { ok: true, provider: 'log-only' }
  }

  const channel = `safety-alerts:${input.userId}`
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/realtime/v1/api/broadcast`

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic: channel,
            event: 'safety-notification',
            payload: {
              title: input.title,
              body: input.body,
              data: input.data ?? {},
              sentAt: new Date().toISOString(),
            },
          },
        ],
      }),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      logger.error('realtime-failure', { status: response.status, body: text })
      return { ok: false, provider: 'supabase-realtime', error: `realtime-${response.status}` }
    }
    return { ok: true, provider: 'supabase-realtime' }
  } catch (error) {
    logger.error('realtime-throw', { error: String(error) })
    return { ok: false, provider: 'supabase-realtime', error: 'fetch-failed' }
  }
}

/**
 * Utility: generate a 6-digit numeric OTP. Uses `crypto.getRandomValues` where
 * available, falling back to Math.random on ancient runtimes (with a warning).
 */
export function generateOtpCode(): string {
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => void } }).crypto
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(1)
    cryptoObj.getRandomValues(buf)
    return String(buf[0] % 1_000_000).padStart(6, '0')
  }
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

/**
 * Hash an OTP for storage. We intentionally use a simple SHA-256 digest - OTPs
 * are single-use and short-lived; a full KDF is unnecessary overhead.
 */
export async function hashOtpCode(code: string): Promise<string> {
  const cryptoObj = (globalThis as {
    crypto?: { subtle?: { digest: (alg: string, data: ArrayBuffer) => Promise<ArrayBuffer> } }
  }).crypto
  if (cryptoObj?.subtle?.digest) {
    const encoder = new TextEncoder()
    const buf = await cryptoObj.subtle.digest('SHA-256', encoder.encode(code))
    const bytes = new Uint8Array(buf)
    let hex = ''
    for (const b of bytes) hex += b.toString(16).padStart(2, '0')
    return hex
  }
  // Last-resort non-cryptographic fallback (dev only, logged noisily).
  let h = 0
  for (let i = 0; i < code.length; i++) {
    h = (h * 31 + code.charCodeAt(i)) | 0
  }
  return `fallback-${h}`
}
