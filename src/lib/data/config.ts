/**
 * Data layer configuration.
 *
 * `USE_SUPABASE_BACKEND` decides whether the read/write path goes to
 * Supabase or falls back to local mock fixtures. The flag is ON by
 * default in any environment that has real Supabase credentials and can
 * be explicitly disabled via `VITE_USE_SUPABASE_BACKEND=false`.
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
 * Resolve the current backend preference.
 *
 * Resolution order:
 *   1. If `VITE_USE_SUPABASE_BACKEND` is set to a falsy value, disable.
 *   2. Otherwise, enable iff Supabase credentials look real.
 */
function resolveBackend(): boolean {
  const override = parseFlag(import.meta.env.VITE_USE_SUPABASE_BACKEND)
  if (override === false) return false
  if (hasPlaceholderCredentials()) return false
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
