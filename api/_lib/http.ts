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

export function methodNotAllowed(res: ResponseLike, allowed: string[]): void {
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

export function tooManyRequests(
  res: ResponseLike,
  message = 'Rate limit exceeded',
  retryAfterSeconds?: number
): void {
  if (retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
  }
  res.status(429).json({ error: message, retryAfterSeconds: retryAfterSeconds ?? null })
}

export function serverError(
  res: ResponseLike,
  message = 'Internal server error',
  details?: unknown
): void {
  const payload: Record<string, unknown> = { error: message }
  if (details !== undefined) payload.details = details
  res.status(500).json(payload)
}

/** Success envelope: `{ data }`. */
export function ok<T>(res: ResponseLike, data: T, status: number = 200): void {
  res.status(status).json({ data })
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
