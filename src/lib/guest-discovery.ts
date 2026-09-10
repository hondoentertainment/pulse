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
