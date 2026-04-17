/**
 * Shared HTTP helpers for Edge Functions under `api/`.
 *
 * Matches the minimal request/response shape already used by `api/events.ts`
 * and `api/pulses.ts` so every handler can be adapted to Vercel's Node or Edge
 * runtime without pulling in runtime-specific types.
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

export const setCors = (res: ResponseLike): void => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

export const ok = <T>(res: ResponseLike, data: T, status: number = 200): void => {
  res.status(status).json({ data })
}

export const fail = (
  res: ResponseLike,
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): void => {
  res.status(status).json({
    error: { code, message, ...(extra ?? {}) },
  })
}

export const methodNotAllowed = (res: ResponseLike, allowed: string[]): void => {
  res.setHeader('Allow', allowed.join(', '))
  fail(res, 405, 'method_not_allowed', `Only ${allowed.join(', ')} allowed`)
}

export const handlePreflight = (req: RequestLike, res: ResponseLike): boolean => {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

export const readHeader = (
  req: RequestLike,
  name: string,
): string | undefined => {
  const headers = req.headers ?? {}
  const lower = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      const value = headers[key]
      if (Array.isArray(value)) return value[0]
      return value
    }
  }
  return undefined
}
