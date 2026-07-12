/**
 * Which product shell to mount at the root.
 *
 *   signal (default) — Pulse Signal daily check-in (`SignalApp`)
 *   venue            — venue decision PWA (`AppRoutes`) — **MVP launch surface**
 *
 * Set `VITE_APP_MODE=signal` for the Pulse Signal research shell.
 * Production defaults to `venue` when `VITE_ALLOW_VENUE_SHELL=true`.
 */

export type AppMode = 'signal' | 'venue'

function parseAppMode(value: unknown): AppMode | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'venue') return 'venue'
  if (normalized === 'signal') return 'signal'
  return null
}

export function resolveAppMode(): AppMode {
  const parsed = parseAppMode(import.meta.env.VITE_APP_MODE) ?? 'venue'
  if (import.meta.env.PROD && parsed === 'venue') {
    const allow =
      typeof import.meta.env.VITE_ALLOW_VENUE_SHELL === 'string' &&
      import.meta.env.VITE_ALLOW_VENUE_SHELL.trim().toLowerCase() === 'true'
    if (!allow) return 'signal'
  }
  if (import.meta.env.PROD && parsed === 'signal') {
    return 'signal'
  }
  return parsed
}

export const APP_MODE: AppMode = resolveAppMode()

export function isVenueAppMode(): boolean {
  return APP_MODE === 'venue'
}

export function isSignalAppMode(): boolean {
  return APP_MODE === 'signal'
}
