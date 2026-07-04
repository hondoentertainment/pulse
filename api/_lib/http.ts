/**
 * Shared HTTP helpers for Vercel serverless functions.
 *
 * The api/ dir uses hand-rolled RequestLike / ResponseLike types (see
 * api/events.ts, api/pulses.ts) rather than pulling in @vercel/node as a
 * dependency. We keep that convention here so the functions stay
 * dependency-light while still being typed.
 */

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
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,DELETE,OPTIONS'
  )
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,X-Requested-With'
  )
}

export function handleOptions(req: RequestLike, res: ResponseLike): boolean {
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

/** CORS preflight handler that also sets CORS headers in one call. */
export function handlePreflight(req: RequestLike, res: ResponseLike): boolean {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

export function methodNotAllowed(res: ResponseLike, allowed: string[] = ['GET', 'POST', 'OPTIONS']): void {
  res.setHeader('Allow', allowed.join(', '))
  res.status(405).json({ error: 'Method not allowed' })
}

export function badRequest(res: ResponseLike, message: string, details?: unknown): void {
  const payload: Record<string, unknown> = { error: message }
  if (details !== undefined) payload.details = details
  res.status(400).json(payload)
}

export function unauthorized(res: ResponseLike, message = 'Unauthorized'): void {
  res.status(401).json({ error: message })
}

export function forbidden(res: ResponseLike, message = 'Forbidden'): void {
  res.status(403).json({ error: message })
}

export function notFound(res: ResponseLike, message = 'Not found'): void {
  res.status(404).json({ error: message })
}

export function tooManyRequests(
  res: ResponseLike,
  message: string | number = 'Rate limit exceeded',
  retryAfterSeconds?: number
): void {
  if (typeof message === 'number') {
    retryAfterSeconds = message
    message = 'Rate limit exceeded'
  }
  if (retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
  }
  res.status(429).json({ error: message, retryAfterSeconds: retryAfterSeconds ?? null })
}

export function serverError(
  res: ResponseLike,
  message: string | Error | unknown = 'Internal server error',
  details?: unknown
): void {
  const resolvedMessage = typeof message === 'string'
    ? message
    : message instanceof Error
      ? message.message
      : 'Internal server error'
  const payload: Record<string, unknown> = { error: resolvedMessage }
  if (details !== undefined) payload.details = details
  res.status(500).json(payload)
}

/** Success envelope: `{ data }`. */
export function ok<T>(res: ResponseLike, data: T, status: number = 200): void {
  res.status(status).json({ data })
}

export function created<T>(res: ResponseLike, data: T): void {
  ok(res, data, 201)
}

/** Error envelope: `{ error: { code, message, ...extra } }`. */
export function fail(
  res: ResponseLike,
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  res.status(status).json({
    error: { code, message, ...(extra ?? {}) },
  })
}

export function getHeader(
  req: RequestLike,
  name: string
): string | undefined {
  const headers = req.headers ?? {}
  const value =
    headers[name] ??
    headers[name.toLowerCase()] ??
    headers[name.toUpperCase()]
  if (Array.isArray(value)) return value[0]
  return value
}

/** Alias of getHeader used by Wave 2 moderation/pulse endpoints. */
export function readHeader(
  req: RequestLike,
  name: string
): string | undefined {
  return getHeader(req, name)
}

export async function readJson<T = unknown>(req: RequestLike): Promise<T> {
  // Vercel auto-parses JSON bodies when Content-Type is application/json.
  if (req.body && typeof req.body === 'object') {
    return req.body as T
  }
  if (typeof req.body === 'string') {
    return JSON.parse(req.body) as T
  }
  throw new Error('Invalid or missing JSON body')
}

export function getAuthUserId(req: RequestLike): string | null {
  const auth = getHeader(req, 'authorization')
  const match = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null
  const token = match?.[1]
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + (payload.length % 4 === 0 ? '' : '='.repeat(4 - (payload.length % 4)))
    const decoded = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8')
    const claims = JSON.parse(decoded) as { sub?: unknown; exp?: unknown }
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null
    return typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null
  } catch {
    return null
  }
}

export function parseQueryInt(
  value: string | string[] | undefined,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : NaN
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

export function parseQueryFloat(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined) return null
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}
