/**
 * Which product shell to mount at the root.
 *
 *   venue (default) — venue discovery PWA (`AppRoutes`), the shipping product
 *   signal          — legacy Pulse Signal daily check-in (`SignalApp`)
 *
 * The venue nightlife app is the product (see README / COMMERCIAL_ROADMAP).
 * Set `VITE_APP_MODE=signal` only to run the legacy Signal surface.
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
  return parseAppMode(import.meta.env.VITE_APP_MODE) ?? 'venue'
}

export const APP_MODE: AppMode = resolveAppMode()

export function isVenueAppMode(): boolean {
  return APP_MODE === 'venue'
}

export function isSignalAppMode(): boolean {
  return APP_MODE === 'signal'
}
