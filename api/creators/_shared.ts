/**
 * Shared helpers for creator-economy Edge Functions.
 *
 * These endpoints are thin: authenticate, validate, call Supabase with the
 * service-role key for service-only tables, return JSON.  The file avoids
 * runtime deps beyond @supabase/supabase-js (already in the workspace) and
 * relies on globalThis.crypto on Edge.
 */

export type RequestLike = {
  method?: string
  body?: unknown
  query?: Record<string, string | string[] | undefined>
  headers?: Record<string, string | string[] | undefined>
}

export type ResponseLike = {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  end: () => void
}

export function setCors(res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

export function readBearerToken(req: RequestLike): string | null {
  const header = req.headers?.authorization || req.headers?.Authorization
  if (!header || typeof header !== 'string') return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? null
}

type JwtShape = {
  sub?: string
  app_metadata?: { role?: string }
}

/**
 * Minimal JWT decoder (no signature verification — Supabase validates).
 * We rely on the Supabase client's RLS for auth-gated queries; this is just
 * to read the uid / role out of the access token.
 */
export function decodeJwt(token: string): JwtShape | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    const json =
      typeof atob === 'function'
        ? atob(payload)
        : Buffer.from(payload, 'base64').toString('utf8')
    return JSON.parse(json) as JwtShape
  } catch {
    return null
  }
}

export function getAuthedUser(req: RequestLike): {
  userId: string | null
  role: string | null
  token: string | null
} {
  const token = readBearerToken(req)
  if (!token) return { userId: null, role: null, token: null }
  const jwt = decodeJwt(token)
  return {
    userId: jwt?.sub ?? null,
    role: jwt?.app_metadata?.role ?? null,
    token,
  }
}

export function requireAuth(
  req: RequestLike,
  res: ResponseLike
): { userId: string; role: string | null; token: string } | null {
  const { userId, role, token } = getAuthedUser(req)
  if (!userId || !token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  return { userId, role, token }
}

export function requireAdmin(
  req: RequestLike,
  res: ResponseLike
): { userId: string; token: string } | null {
  const authed = requireAuth(req, res)
  if (!authed) return null
  if (authed.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return { userId: authed.userId, token: authed.token }
}

// ---------------------------------------------------------------------------
// Tiny in-memory rate limiter.  Good enough for per-creator / per-IP limits
// within a single Edge runtime; production should back this with Redis.
// ---------------------------------------------------------------------------
declare global {
  var __creatorRateLimitStore: Map<string, { count: number; resetAt: number }> | undefined
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const store =
    globalThis.__creatorRateLimitStore ??
    (globalThis.__creatorRateLimitStore = new Map())
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0 }
  entry.count += 1
  return { allowed: true, remaining: limit - entry.count }
}

export function jsonError(res: ResponseLike, code: number, message: string) {
  res.status(code).json({ error: message })
}
