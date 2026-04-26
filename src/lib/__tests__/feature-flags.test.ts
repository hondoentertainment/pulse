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

  it('returns a boolean for safetyKit flag', () => {
    const result = isFeatureEnabled('safetyKit')
    expect(typeof result).toBe('boolean')
  })
})

describe('featureFlags defaults', () => {
  it('has all expected flag keys', () => {
    expect(featureFlags).toHaveProperty('integrations')
    expect(featureFlags).toHaveProperty('socialDashboard')
    expect(featureFlags).toHaveProperty('smartMap')
    expect(featureFlags).toHaveProperty('safetyKit')
  })

  it('defaults to true for all flags when no env vars override', () => {
    // In test environment, no VITE_FF_ / VITE_SAFETY_KIT_ env vars are set,
    // so parseFlag falls back to defaults which are all true
    expect(featureFlags.integrations).toBe(true)
    expect(featureFlags.socialDashboard).toBe(true)
    expect(featureFlags.smartMap).toBe(true)
    expect(featureFlags.safetyKit).toBe(true)
  })
})
