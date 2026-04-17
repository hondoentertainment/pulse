/**
 * Client-side auth guards for write paths.
 *
 * RLS is the authoritative enforcement layer — these helpers are just
 * for failing fast (and with a nicer message) before we hit the network.
 *
 * Usage:
 *   const userId = await requireAuth()          // throws on anon
 *   const userId = await requireAuth({ redirect: '/login' })
 *
 *   // Inside a query wrapper:
 *   await assertWriteAllowed('create pulse')
 */

import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export class AuthRequiredError extends Error {
  code = 'AUTH_REQUIRED' as const
  constructor(action?: string) {
    super(action ? `Sign in required to ${action}.` : 'Sign in required.')
    this.name = 'AuthRequiredError'
  }
}

interface RequireAuthOptions {
  /**
   * When set, the helper will navigate the browser to this path after throwing.
   * The caller can also catch AuthRequiredError and do its own routing.
   */
  redirect?: string
  /**
   * Human description of the action. Used in the thrown error message.
   * Example: "create a pulse", "follow venue".
   */
  action?: string
}

/**
 * Returns the current Supabase session. Throws AuthRequiredError if the
 * user isn't signed in. Optionally redirects the browser.
 */
export async function requireAuth(options: RequireAuthOptions = {}): Promise<Session> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    // Propagate as auth-required; a stale token is effectively unauth.
    maybeRedirect(options.redirect)
    throw new AuthRequiredError(options.action)
  }
  if (!data.session) {
    maybeRedirect(options.redirect)
    throw new AuthRequiredError(options.action)
  }
  return data.session
}

/**
 * Returns the current authenticated user id or throws.
 * Convenience wrapper for the common case.
 */
export async function requireUserId(options: RequireAuthOptions = {}): Promise<string> {
  const session = await requireAuth(options)
  return session.user.id
}

/**
 * Assert a write is allowed from the current session.
 * Distinct from requireAuth only for call-site readability.
 */
export async function assertWriteAllowed(action: string): Promise<string> {
  return requireUserId({ action })
}

/**
 * Non-throwing variant. Useful inside hooks where we want to conditionally
 * render a sign-in affordance without unwinding the render tree.
 */
export async function getUserIdOrNull(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/**
 * Reads the `role` claim from the current JWT. Mirrors the server-side
 * `is_admin()` helper used in RLS policies.
 */
export async function isAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return false
  const claims = parseJwtClaims(session.access_token)
  if (!claims) return false
  const appMetaRole =
    (claims.app_metadata as { role?: string } | undefined)?.role
  const topLevelRole = claims.role as string | undefined
  return appMetaRole === 'admin' || topLevelRole === 'admin'
}

// ── Internal ─────────────────────────────────────────────────────────────

function maybeRedirect(path?: string) {
  if (!path) return
  if (typeof window === 'undefined') return
  // Avoid redirect loops when the target is the current page
  if (window.location.pathname === path) return
  window.location.assign(path)
}

/**
 * Decode the payload of a JWT without verifying the signature.
 * Verification lives on the server; this is purely for UX hints.
 */
function parseJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const json = typeof atob === 'function' ? atob(padded) : ''
    return json ? (JSON.parse(json) as Record<string, unknown>) : null
  } catch {
    return null
  }
}
