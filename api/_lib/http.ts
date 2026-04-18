/**
 * Shared HTTP helpers for Edge Functions.
 *
 * These helpers adapt the same `RequestLike`/`ResponseLike` shapes already
 * used by `api/pulses.ts` and `api/events.ts`, so the video-feed endpoints
 * integrate with the existing Vercel runtime without pulling in new
 * framework types. The helpers are intentionally dependency-free.
 */

export type RequestLike = {
  method?: string
  headers?: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  url?: string
  body?: unknown
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

export function handlePreflight(req: RequestLike, res: ResponseLike): boolean {
  if (req.method === 'OPTIONS') {
    setCors(res)
    res.status(200).end()
    return true
  }
  return false
}

export function methodNotAllowed(res: ResponseLike): void {
  res.status(405).json({ error: 'Method not allowed' })
}

export function badRequest(res: ResponseLike, message: string): void {
  res.status(400).json({ error: message })
}

export function unauthorized(res: ResponseLike, message = 'Unauthorized'): void {
  res.status(401).json({ error: message })
}

export function tooManyRequests(res: ResponseLike, retryAfterSeconds: number): void {
  res.setHeader('Retry-After', String(retryAfterSeconds))
  res.status(429).json({ error: 'Too many requests', retryAfterSeconds })
}

export function ok<T>(res: ResponseLike, data: T, cacheSeconds?: number): void {
  if (cacheSeconds && cacheSeconds > 0) {
    res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`)
  }
  res.status(200).json({ data })
}

export function created<T>(res: ResponseLike, data: T): void {
  res.status(201).json({ data })
}

/**
 * Extracts the bearer token from a request, if present. Returns the raw token
 * (no `Bearer ` prefix). Falls back to `x-user-id` in test/dev mode.
 */
export function getAuthUserId(req: RequestLike): string | null {
  const auth = pickHeader(req.headers, 'authorization')
  if (auth) {
    const [scheme, token] = auth.split(' ')
    if (scheme?.toLowerCase() === 'bearer' && token) return token
  }
  // Dev/test shortcut — never present in production requests
  const testHeader = pickHeader(req.headers, 'x-user-id')
  if (testHeader) return testHeader
  return null
}

function pickHeader(
  headers: RequestLike['headers'],
  key: string,
): string | undefined {
  if (!headers) return undefined
  const value = headers[key] ?? headers[key.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return value
}

/**
 * Parse a numeric query-string param with bounds.
 */
export function parseQueryInt(
  value: string | string[] | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'string') return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

export function parseQueryFloat(
  value: string | string[] | undefined,
): number | null {
  if (typeof value !== 'string') return null
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}
