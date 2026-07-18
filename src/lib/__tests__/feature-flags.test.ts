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

  it('defaults core flags on and unfinished surfaces off', () => {
    // In test environment, no VITE_* overrides — fall back to module defaults.
    expect(featureFlags.integrations).toBe(true)
    expect(featureFlags.socialDashboard).toBe(true) // !isProdBuild
    expect(featureFlags.smartMap).toBe(true)
    expect(featureFlags.safetyKit).toBe(false)
    expect(featureFlags.ticketing).toBe(false)
    expect(featureFlags.aiConcierge).toBe(false)
    expect(featureFlags.vibeVision).toBe(false)
    expect(featureFlags.creatorEconomy).toBe(false)
  })
})

