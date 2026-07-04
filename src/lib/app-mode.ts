/**
 * Which product shell to mount at the root.
 *
 *   signal (default) — Pulse Signal daily check-in (`SignalApp`)
 *   venue            — venue discovery PWA (`AppRoutes`)
 *
 * Set `VITE_APP_MODE=venue` for E2E / staging of the full venue product.
 * Production defaults to `signal` per the current launch surface.
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
  return parseAppMode(import.meta.env.VITE_APP_MODE) ?? 'signal'
}

export const APP_MODE: AppMode = resolveAppMode()

export function isVenueAppMode(): boolean {
  return APP_MODE === 'venue'
}

export function isSignalAppMode(): boolean {
  return APP_MODE === 'signal'
}
