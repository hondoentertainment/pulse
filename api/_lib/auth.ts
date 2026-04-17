/**
 * Server-side Supabase JWT verification.
 *
 * We call the Supabase Auth `/auth/v1/user` endpoint with the user's
 * access token. This avoids bundling jose/jsonwebtoken just to verify a
 * JWT — Supabase does the signature + expiration check for us and returns
 * the user record.
 *
 * Env vars expected:
 *   SUPABASE_URL              (server-side, no VITE_ prefix)
 *   SUPABASE_ANON_KEY         (server-side, no VITE_ prefix)
 *   SUPABASE_ADMIN_EMAILS     (optional comma-separated allowlist for admin-only routes)
 */

import { getHeader, type RequestLike } from './http'

export interface AuthedUser {
  id: string
  email?: string
  role?: string
  isAdmin: boolean
}

export interface AuthResult {
  ok: boolean
  user?: AuthedUser
  error?: string
}

function getSupabaseUrl(): string | null {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    null
  )
}

function getSupabaseAnonKey(): string | null {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    null
  )
}

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false
  const raw = process.env.SUPABASE_ADMIN_EMAILS || ''
  const allowlist = raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}

function extractBearer(req: RequestLike): string | null {
  const header = getHeader(req, 'authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

export async function verifySupabaseJwt(req: RequestLike): Promise<AuthResult> {
  const token = extractBearer(req)
  if (!token) return { ok: false, error: 'Missing Bearer token' }

  const url = getSupabaseUrl()
  const anon = getSupabaseAnonKey()
  if (!url || !anon) {
    return { ok: false, error: 'Auth not configured on server' }
  }

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
    })

    if (!response.ok) {
      return { ok: false, error: `Auth rejected (${response.status})` }
    }

    const payload = (await response.json()) as {
      id?: string
      email?: string
      role?: string
    }

    if (!payload?.id) return { ok: false, error: 'Invalid auth payload' }

    return {
      ok: true,
      user: {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        isAdmin: isAdminEmail(payload.email),
      },
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Auth error' }
  }
}
