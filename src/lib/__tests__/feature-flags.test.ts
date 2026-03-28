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
})

describe('featureFlags defaults', () => {
  it('has all expected flag keys', () => {
    expect(featureFlags).toHaveProperty('integrations')
    expect(featureFlags).toHaveProperty('socialDashboard')
    expect(featureFlags).toHaveProperty('smartMap')
  })

  it('reflects production launch defaults', () => {
    // integrations and socialDashboard are disabled by default at launch
    expect(featureFlags.integrations).toBe(false)
    expect(featureFlags.socialDashboard).toBe(false)
    // smartMap is enabled by default
    expect(featureFlags.smartMap).toBe(true)
  })
})
