/**
 * Lightweight JWT auth for Edge Functions.
 *
 * Extracts the bearer token from `Authorization: Bearer <jwt>`, decodes the
 * payload, and verifies basic claims (`exp`, `sub`). Signature verification is
 * delegated to Supabase — we pass the raw token through on any DB call so RLS
 * enforces the real identity. This helper is only for pre-filtering obviously
 * unauthenticated requests and for gating rate-limit keys by user id.
 *
 * Do NOT rely on this for authorization decisions. Always pair it with RLS.
 */

import type { RequestLike } from './http'
import { readHeader } from './http'

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
  // atob is available in both modern Node (>=16) and Edge runtimes.
  if (typeof atob === 'function') {
    try {
      return atob(base64)
    } catch {
      return ''
    }
  }
  // Fallback for older environments.
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

export const extractBearer = (req: RequestLike): string | null => {
  const header = readHeader(req, 'authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

export const requireAuth = (req: RequestLike): AuthSuccess | AuthError => {
  const token = extractBearer(req)
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
