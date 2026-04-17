/**
 * Server-side auth helpers for Edge Functions.
 *
 * Two styles coexist:
 *
 *   1. `verifySupabaseJwt(req)` — async, calls Supabase `/auth/v1/user` to
 *      verify signature + expiration and return the full user record. Used
 *      by higher-assurance endpoints (e.g. admin-only routes).
 *
 *   2. `requireAuth(req)` — sync, decodes the JWT locally and checks
 *      basic claims (sub + exp). Signature verification is delegated to
 *      Supabase RLS — we pass the raw token through on every DB call so
 *      RLS enforces the real identity. Use this for pre-filtering and for
 *      keying rate limiters by user id.
 *
 * Do NOT rely on `requireAuth` alone for authorization decisions — pair it
 * with RLS or `verifySupabaseJwt` where stakes are high.
 *
 * Env vars (for `verifySupabaseJwt`):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ADMIN_EMAILS (optional).
 */

import { getHeader, readHeader, type RequestLike } from './http'

// ─── Authoritative verification via Supabase ───

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
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null
}

function getSupabaseAnonKey(): string | null {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null
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

export function extractBearer(req: RequestLike): string | null {
  const header = getHeader(req, 'authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
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

// ─── Lightweight local JWT decode (pre-filter + rate-limit keying) ───

export type AuthClaims = {
  sub: string
  exp?: number
  iat?: number
  role?: string
  email?: string
  aud?: string | string[]
}

export type AuthContext = {
  token: string
  claims: AuthClaims
  userId: string
}

export type AuthError = {
  ok: false
  status: number
  code: string
  message: string
}

export type AuthSuccess = {
  ok: true
  context: AuthContext
}

const decodeBase64Url = (input: string): string => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const base64 = padded + pad
  if (typeof atob === 'function') {
    try {
      return atob(base64)
    } catch {
      return ''
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B: any = (globalThis as any).Buffer
  if (B && typeof B.from === 'function') {
    return B.from(base64, 'base64').toString('utf-8')
  }
  return ''
}

export const decodeJwt = (token: string): AuthClaims | null => {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = decodeBase64Url(parts[1])
    if (!json) return null
    const parsed = JSON.parse(json) as AuthClaims
    if (!parsed || typeof parsed !== 'object' || !parsed.sub) return null
    return parsed
  } catch {
    return null
  }
}

const extractBearerViaReadHeader = (req: RequestLike): string | null => {
  const header = readHeader(req, 'authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

export const requireAuth = (req: RequestLike): AuthSuccess | AuthError => {
  const token = extractBearerViaReadHeader(req)
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'unauthenticated',
      message: 'Missing Authorization: Bearer <token> header',
    }
  }

  const claims = decodeJwt(token)
  if (!claims) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_token',
      message: 'Token is not a decodable JWT',
    }
  }

  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
    return {
      ok: false,
      status: 401,
      code: 'token_expired',
      message: 'Token is expired',
    }
  }

  return {
    ok: true,
    context: { token, claims, userId: claims.sub },
  }
}
