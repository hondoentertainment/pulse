import { describe, expect, it } from 'vitest'
import {
  AUTH_PATH,
  DISCOVERY_AUTH_GATE_COPY,
  getCreatePulseAuthRedirect,
  getWriteAuthRedirect,
  shouldBlockDiscoveryForAuth,
  WRITE_AUTH_COPY,
} from '../guest-discovery'

describe('guest discovery policy', () => {
  it('never walls map browse behind AuthGate after onboarding', () => {
    expect(shouldBlockDiscoveryForAuth({
      isPlaceholder: false,
      hasSession: false,
      authLoading: false,
      hasCompletedOnboarding: true,
    })).toBe(false)
  })

  it('keeps the production AuthGate copy documented so it cannot silently return as a discovery wall', () => {
    expect(DISCOVERY_AUTH_GATE_COPY).toBe("Sign in to discover what's buzzing near you")
  })

  it('requires sign-in to create a Pulse when Supabase is real and there is no session', () => {
    expect(getCreatePulseAuthRedirect({
      isPlaceholder: false,
      hasSession: false,
    })).toBe(AUTH_PATH)
  })

  it('allows create in placeholder/demo mode without a session', () => {
    expect(getCreatePulseAuthRedirect({
      isPlaceholder: true,
      hasSession: false,
    })).toBeNull()
  })

  it('allows create when a session exists', () => {
    expect(getCreatePulseAuthRedirect({
      isPlaceholder: false,
      hasSession: true,
    })).toBeNull()
  })

  it('redirects guest check-in and review to /auth, not toast-only', () => {
    expect(getWriteAuthRedirect({ isPlaceholder: false, hasSession: false })).toBe(AUTH_PATH)
    expect(WRITE_AUTH_COPY.checkIn.description).toContain('check in')
    expect(WRITE_AUTH_COPY.review.description).toContain('live review')
    expect(WRITE_AUTH_COPY.intel.description).toContain('live intel')
  })
})
