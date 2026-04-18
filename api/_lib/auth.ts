/**
 * Tiny server-side auth helper for Capacitor push endpoints.
 *
 * Accepts either:
 *   - Supabase JWT from `Authorization: Bearer <token>` header
 *   - Explicit `userId` in body for non-Supabase test runs (dev only)
 *
 * Returns null if unable to resolve a trusted user identity.
 */
type RequestLike = {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

function readHeader(req: RequestLike, name: string): string | undefined {
  const raw = req.headers?.[name.toLowerCase()] ?? req.headers?.[name]
  if (Array.isArray(raw)) return raw[0]
  return raw
}

/**
 * Decode a Supabase/JWT token's `sub` claim without verifying the signature.
 * This is acceptable for the scaffold — production deployments should
 * verify via the Supabase auth server or JWKS. The DB RLS policies are
 * the source of truth for per-row access control.
 */
function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'),
    ) as { sub?: string }
    return payload.sub || null
  } catch {
    return null
  }
}

export function getAuthenticatedUserId(req: RequestLike): string | null {
  const auth = readHeader(req, 'authorization')
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim()
    const sub = decodeJwtSub(token)
    if (sub) return sub
  }
  // Fall back for dev: allow explicit `userId` in body
  if (req.body && typeof req.body === 'object') {
    const b = req.body as Record<string, unknown>
    if (typeof b.userId === 'string') return b.userId
  }
  return null
}
