import { describe, it, expect } from 'vitest'
import { isFeatureEnabled, featureFlags } from '../feature-flags'

describe('isFeatureEnabled', () => {
  it('returns a boolean for integrations flag', () => {
    const result = isFeatureEnabled('integrations')
    expect(typeof result).toBe('boolean')
  })

  it('returns a boolean for socialDashboard flag', () => {
    const result = isFeatureEnabled('socialDashboard')
    expect(typeof result).toBe('boolean')
  })

  it('returns a boolean for smartMap flag', () => {
    const result = isFeatureEnabled('smartMap')
    expect(typeof result).toBe('boolean')
  })

  it('returns a boolean for ticketing flag', () => {
    const result = isFeatureEnabled('ticketing')
    expect(typeof result).toBe('boolean')
  })
})

describe('featureFlags defaults', () => {
  it('has all expected flag keys', () => {
    expect(featureFlags).toHaveProperty('integrations')
    expect(featureFlags).toHaveProperty('socialDashboard')
    expect(featureFlags).toHaveProperty('smartMap')
    expect(featureFlags).toHaveProperty('ticketing')
  })

  it('defaults to expected values when no env vars override', () => {
    // In test environment, no VITE_FF_ env vars are set,
    // so parseFlag falls back to defaults.
    expect(featureFlags.integrations).toBe(true)
    expect(featureFlags.socialDashboard).toBe(true)
    expect(featureFlags.smartMap).toBe(true)
    // Ticketing is default-off until Stripe + staff migration are wired.
    expect(featureFlags.ticketing).toBe(false)
  })
})
