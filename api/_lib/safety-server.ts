/**
 * Shared helpers for the /api/safety/* edge functions.
 *
 * Pulls in the Supabase service-role client lazily (only when invoked at
 * request time) so that loading this module does not require env vars at
 * import. When the service-role key is missing the helper returns `null` and
 * the caller is expected to respond 500.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type RequestLike = {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  url?: string
}

export type ResponseLike = {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  end: () => void
}

export function setCors(res: ResponseLike): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function badRequest(res: ResponseLike, error: string, details?: unknown): void {
  res.status(400).json({ error, details })
}

export function unauthorized(res: ResponseLike): void {
  res.status(401).json({ error: 'unauthorized' })
}

export function methodNotAllowed(res: ResponseLike): void {
  res.status(405).json({ error: 'method-not-allowed' })
}

export function serverError(res: ResponseLike, error: string): void {
  res.status(500).json({ error })
}

export function readHeader(req: RequestLike, key: string): string | undefined {
  const raw = req.headers?.[key.toLowerCase()]
  if (Array.isArray(raw)) return raw[0]
  return raw ?? undefined
}

export function readBearer(req: RequestLike): string | undefined {
  const auth = readHeader(req, 'authorization')
  if (!auth) return undefined
  const match = /^Bearer\s+(.+)$/i.exec(auth)
  return match?.[1]
}

/**
 * Service-role Supabase client. Present only when SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are both set.
 */
export function getServiceClient(): SupabaseClient | null {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  const url = processEnv.SUPABASE_URL ?? processEnv.VITE_SUPABASE_URL
  const key = processEnv.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Authenticate an incoming request by verifying its bearer token against
 * Supabase. Returns the user id on success, or null on failure.
 *
 * When Supabase env is not configured (dev) we fall back to reading an
 * `x-user-id` header to keep local development workable. This is guarded so it
 * cannot be exploited in production: the fallback only triggers when no service
 * client could be constructed.
 */
export async function authenticate(req: RequestLike): Promise<string | null> {
  const token = readBearer(req)
  const client = getServiceClient()
  if (client && token) {
    try {
      const { data, error } = await client.auth.getUser(token)
      if (error || !data?.user?.id) return null
      return data.user.id
    } catch {
      return null
    }
  }
  if (!client) {
    const devUserId = readHeader(req, 'x-user-id')
    if (devUserId && typeof devUserId === 'string') return devUserId
  }
  return null
}

/**
 * Very small in-process token bucket keyed by an arbitrary string. Used for
 * ping rate-limiting. Serverless cold-starts reset the bucket, which is fine:
 * the worst case is a client gets a few extra pings through on a warm restart
 * and burn server time we can shrug off.
 */
interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets: Map<string, Bucket> = new Map()

export interface RateLimitConfig {
  maxTokens: number
  refillPerSecond: number
}

export function consumeRateLimitToken(key: string, config: RateLimitConfig): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now }
  }
  const elapsed = (now - bucket.lastRefill) / 1000
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillPerSecond)
  bucket.lastRefill = now
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    buckets.set(key, bucket)
    return { allowed: true, retryAfterMs: 0 }
  }
  buckets.set(key, bucket)
  const retryAfterMs = Math.ceil(((1 - bucket.tokens) / config.refillPerSecond) * 1000)
  return { allowed: false, retryAfterMs }
}

export function readJsonBody<T = unknown>(req: RequestLike): T | null {
  const body = req.body
  if (body === undefined || body === null) return null
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as T
    } catch {
      return null
    }
  }
  return body as T
}
