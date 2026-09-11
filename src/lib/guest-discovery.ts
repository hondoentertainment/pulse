/**
 * Guest discovery policy.
 *
 * Map + venue browse is public. Auth gates write surfaces only:
 * Create Pulse, live reviews, inbox, and claims — not discovery.
 */

export const AUTH_PATH = '/auth'

export const DISCOVERY_AUTH_GATE_COPY = "Sign in to discover what's buzzing near you"

/**
 * Whether the post-onboarding shell should be replaced by AuthGate.
 * Always false: guests must reach map + venues after Start Exploring.
 */
export function shouldBlockDiscoveryForAuth(_input?: {
  isPlaceholder?: boolean
  hasSession?: boolean
  authLoading?: boolean
  hasCompletedOnboarding?: boolean
}): boolean {
  return false
}

/**
 * Create Pulse (and other write actions) require a real session when
 * Supabase is configured. Placeholder/demo mode stays usable without auth.
 */
export function getCreatePulseAuthRedirect(input: {
  isPlaceholder: boolean
  hasSession: boolean
}): string | null {
  if (input.isPlaceholder || input.hasSession) return null
  return AUTH_PATH
}

/**
 * Guest check-in, live review, and live intel must land on `/auth`
 * (not toast-only). Same gate as Create Pulse.
 */
export function getWriteAuthRedirect(input: {
  isPlaceholder: boolean
  hasSession: boolean
}): string | null {
  return getCreatePulseAuthRedirect(input)
}

export const WRITE_AUTH_COPY = {
  checkIn: { title: 'Sign in required', description: 'Sign in to check in.' },
  review: { title: 'Sign in required', description: 'Sign in to post a live review.' },
  intel: { title: 'Sign in required', description: 'Sign in to report live intel.' },
  create: { title: 'Sign in required', description: 'Sign in to create a Pulse.' },
} as const

/** Close the composer whenever a write action redirects to /auth. */
export function closeComposerForAuthRedirect(setters: {
  setCreateDialogOpen?: (open: boolean) => void
  setVenueForPulse?: (venue: null) => void
}): void {
  setters.setCreateDialogOpen?.(false)
  setters.setVenueForPulse?.(null)
}
