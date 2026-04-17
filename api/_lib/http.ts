/**
 * HTTP helpers for Vercel Edge / Node-style handlers.
 *
 * Keep this dependency-light. Request/response shapes mirror the minimal
 * subset consumed by the existing `api/pulses.ts` and `api/events.ts`
 * handlers so all Edge Functions share one vocabulary.
 */

export type RequestLike = {
  method?: string
  headers?: Record<string, string | string[] | undefined> | Headers
  body?: unknown
  url?: string
  query?: Record<string, string | string[] | undefined>
}

export type ResponseLike = {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  end: (body?: string) => void
}

export const setCors = (res: ResponseLike): void => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Stripe-Signature')
}

export const handlePreflight = (req: RequestLike, res: ResponseLike): boolean => {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

export const methodNotAllowed = (res: ResponseLike): void => {
  res.status(405).json({ error: 'Method not allowed' })
}

export const badRequest = (res: ResponseLike, message: string, details?: unknown): void => {
  res.status(400).json({ error: message, details })
}

export const unauthorized = (res: ResponseLike, message = 'Unauthorized'): void => {
  res.status(401).json({ error: message })
}

export const forbidden = (res: ResponseLike, message = 'Forbidden'): void => {
  res.status(403).json({ error: message })
}

export const notFound = (res: ResponseLike, message = 'Not found'): void => {
  res.status(404).json({ error: message })
}

export const serverError = (res: ResponseLike, err: unknown): void => {
  const message = err instanceof Error ? err.message : 'Internal error'
  res.status(500).json({ error: message })
}

export const getHeader = (req: RequestLike, name: string): string | undefined => {
  if (!req.headers) return undefined
  if (req.headers instanceof Headers) {
    return req.headers.get(name) ?? undefined
  }
  const value = req.headers[name.toLowerCase()] ?? req.headers[name]
  if (Array.isArray(value)) return value[0]
  return value
}
