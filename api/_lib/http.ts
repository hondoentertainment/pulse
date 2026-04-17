/**
 * Minimal HTTP helpers shared by Edge Functions.
 *
 * Mirrors the Vercel serverless function request/response shape without
 * pulling in `@vercel/node` as a runtime dependency — the request/response
 * are duck-typed so the same handler can be run under Node (tests) and
 * Vercel Edge Runtime.
 */

export interface RequestLike {
  method?: string
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
  query?: Record<string, string | string[] | undefined>
}

export interface ResponseLike {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  send: (payload: string | Uint8Array) => void
  write: (chunk: string | Uint8Array) => void
  end: (payload?: string | Uint8Array) => void
}

export function setCors(res: ResponseLike): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

export function methodNotAllowed(res: ResponseLike, allowed: string[]): void {
  res.setHeader('Allow', allowed.join(','))
  res.status(405).json({ error: 'Method not allowed' })
}

export function jsonError(res: ResponseLike, code: number, message: string, extra?: Record<string, unknown>): void {
  res.status(code).json({ error: message, ...(extra ?? {}) })
}

export function readHeader(req: RequestLike, name: string): string | undefined {
  const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name]
  if (Array.isArray(value)) return value[0]
  return typeof value === 'string' ? value : undefined
}
