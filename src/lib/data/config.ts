/**
 * Data layer configuration.
 *
 * `USE_SUPABASE_BACKEND` decides whether the read/write path goes to
 * Supabase or falls back to local mock fixtures. The flag is ON by
 * default in any environment that has **both** `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` configured with real (non-placeholder)
 * values. It can be explicitly disabled via `VITE_USE_SUPABASE_BACKEND=false`
 * and can be explicitly enabled with `VITE_USE_SUPABASE_BACKEND=true` for
 * tests — but opting in without credentials will still short-circuit to
 * `false` because there is nothing to talk to.
 *
 * In local dev without credentials the flag resolves to `false` so the
 * app keeps booting against mock data.
 */

import { hasPlaceholderCredentials } from '@/lib/supabase'

function parseFlag(value: unknown): boolean | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return null
}

/**
 * Returns true iff both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
 * are present and look like real (non-placeholder) values. Exported so
 * tests and the UI layer can reason about configuration without pulling
 * in the Supabase client.
 */
export function hasSupabaseEnv(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return false
  // Defer to the canonical placeholder check so the two predicates stay
  // in sync if the placeholder list grows.
  return !hasPlaceholderCredentials()
}

/**
 * Resolve the current backend preference.
 *
 * Resolution order:
 *   1. If Supabase env vars are missing/placeholder, force OFF — we
 *      cannot talk to Supabase without them, so ignore any override.
 *   2. If `VITE_USE_SUPABASE_BACKEND` is explicitly set, honour it.
 *   3. Otherwise, default to ON whenever env vars are present.
 */
export function resolveBackend(): boolean {
  if (!hasSupabaseEnv()) return false
  const override = parseFlag(import.meta.env.VITE_USE_SUPABASE_BACKEND)
  if (override === false) return false
  return true
}

export const USE_SUPABASE_BACKEND: boolean = resolveBackend()

/**
 * Emit a one-time developer note when the app is running against mock
 * data so nobody is surprised when local changes appear absent from the
 * server. Safe to call from any module-load path.
 */
let warnedDevOnce = false
export function warnIfUsingMockBackend(): void {
  if (USE_SUPABASE_BACKEND) return
  if (warnedDevOnce) return
  warnedDevOnce = true
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info(
      '[pulse] USE_SUPABASE_BACKEND is OFF — reads/writes use local mock fixtures. ' +
        'Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to enable the Supabase backend.',
    )
  }
}
