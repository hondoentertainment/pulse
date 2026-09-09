/**
 * Which product shell to mount at the root.
 *
 *   venue  (default) — nightlife venue + map PWA (`AppRoutes`)
 *   signal           — Pulse Signal daily check-in (`SignalApp`)
 *
 * Production defaults to `venue` (owner-approved 2026-09-09, supersedes #56).
 * Set `VITE_APP_MODE=signal` to run Signal behind a flag.
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

export function appDocumentTitle(mode: AppMode = APP_MODE): string {
  return mode === 'signal'
    ? 'Pulse Signal'
    : 'Pulse — where the energy is right now'
}

export function applyAppDocumentTitle(): void {
  if (typeof document === 'undefined') return
  document.title = appDocumentTitle()
}
