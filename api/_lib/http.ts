/**
 * Shared HTTP helpers for Vercel-style handlers. Intentionally minimal —
 * we do not depend on `next` or `@vercel/node` types; callers pass
 * duck-typed req/res objects.
 */

export interface ApiRequest {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

export interface ApiResponse {
  status: (code: number) => ApiResponse
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  end: () => void
}

export function setCors(res: ApiResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function sendJson(res: ApiResponse, status: number, payload: unknown): void {
  res.status(status)
  res.setHeader('content-type', 'application/json')
  res.json(payload)
}

export function bearerToken(req: ApiRequest): string | null {
  const raw = req.headers?.['authorization']
  const header = Array.isArray(raw) ? raw[0] : raw
  if (!header) return null
  if (!header.toLowerCase().startsWith('bearer ')) return null
  return header.slice(7).trim() || null
}
