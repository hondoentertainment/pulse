import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock import.meta.env before importing any module that uses it
// ---------------------------------------------------------------------------
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_FF_ENABLE_INTEGRATIONS: undefined,
      VITE_FF_ENABLE_SOCIAL_DASHBOARD: undefined,
      VITE_FF_ENABLE_SMART_MAP: undefined,
    },
  },
})

import {
  hashToPercent,
  isFeatureEnabledForUser,
  setFeatureOverride,
  clearFeatureOverrides,
  getAllOverrides,
  engagementFlagRegistry,
  isFeatureEnabled,
  featureFlags,
  type EngagementFlag,
} from '@/lib/feature-flags'

// ---------------------------------------------------------------------------
// Minimal localStorage stub for the node test environment
// ---------------------------------------------------------------------------
function makeLocalStorageStub() {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let ls: ReturnType<typeof makeLocalStorageStub>

beforeEach(() => {
  ls = makeLocalStorageStub()
  vi.stubGlobal('localStorage', ls)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// 1. Feature Flag Registry
// ---------------------------------------------------------------------------

describe('engagementFlagRegistry', () => {
  const ALL_FLAGS: EngagementFlag[] = [
    'tonightsPickCard',
    'liveActivityFeed',
    'goingTonight',
    'emojiReactions',
    'venueEnergyTimeline',
    'venueComparison',
    'streakRewards',
    'neighborhoodWalkthrough',
    'venueQuickBoost',
    'offlineMode',
  ]

  it('defines all 10 engagement flags', () => {
    expect(Object.keys(engagementFlagRegistry)).toHaveLength(10)
    ALL_FLAGS.forEach(flag => {
      expect(engagementFlagRegistry).toHaveProperty(flag)
    })
  })

  it('each flag has enabled, rolloutPercentage, and description', () => {
    ALL_FLAGS.forEach(flag => {
      const config = engagementFlagRegistry[flag]
      expect(typeof config.enabled).toBe('boolean')
      expect(typeof config.rolloutPercentage).toBe('number')
      expect(config.rolloutPercentage).toBeGreaterThanOrEqual(0)
      expect(config.rolloutPercentage).toBeLessThanOrEqual(100)
      expect(typeof config.description).toBe('string')
      expect(config.description.length).toBeGreaterThan(0)
    })
  })

  it('all flags are enabled at 100% by default', () => {
    Object.values(engagementFlagRegistry).forEach(config => {
      expect(config.enabled).toBe(true)
      expect(config.rolloutPercentage).toBe(100)
    })
  })
})

// ---------------------------------------------------------------------------
// 2. hashToPercent — consistent hashing
// ---------------------------------------------------------------------------

describe('hashToPercent', () => {
  it('returns a number in [0, 99] for arbitrary strings', () => {
    const inputs = ['', 'a', 'hello', 'flagName+userId-xyz', 'tonightsPickCard+user-abc-123']
    inputs.forEach(input => {
      const result = hashToPercent(input)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(99)
      expect(Number.isInteger(result)).toBe(true)
    })
  })

  it('is deterministic — same input always produces same output', () => {
    const input = 'streakRewards+user-42'
    const first = hashToPercent(input)
    const second = hashToPercent(input)
    const third = hashToPercent(input)
    expect(first).toBe(second)
    expect(second).toBe(third)
  })

  it('produces different outputs for different inputs', () => {
    const results = new Set(
      ['flag1+u1', 'flag2+u1', 'flag1+u2', 'flag3+u99', 'offlineMode+user-xyz'].map(hashToPercent)
    )
    // Most inputs should hash differently — at least 3 distinct values from 5
    expect(results.size).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// 3. isFeatureEnabledForUser — rollout logic
// ---------------------------------------------------------------------------

describe('isFeatureEnabledForUser', () => {
  it('returns false for an unknown flag with no fallback', () => {
    expect(isFeatureEnabledForUser('nonExistentFlag', 'user-1')).toBe(false)
  })

  it('returns true when rolloutPercentage is 100 and flag is enabled', () => {
    // All default flags are at 100%, so any user should be included
    expect(isFeatureEnabledForUser('tonightsPickCard', 'any-user-id')).toBe(true)
    expect(isFeatureEnabledForUser('offlineMode', 'another-user')).toBe(true)
  })

  it('returns false when flag is globally disabled (enabled: false)', () => {
    // Temporarily patch the registry
    const original = { ...engagementFlagRegistry.streakRewards }
    engagementFlagRegistry.streakRewards = { ...original, enabled: false }

    expect(isFeatureEnabledForUser('streakRewards', 'user-1')).toBe(false)

    // Restore
    engagementFlagRegistry.streakRewards = original
  })

  it('respects rollout percentage — bucket < percentage = true, else false', () => {
    const original = { ...engagementFlagRegistry.emojiReactions }

    // Set 0% rollout → no user should be in
    engagementFlagRegistry.emojiReactions = { ...original, rolloutPercentage: 0 }
    expect(isFeatureEnabledForUser('emojiReactions', 'user-1')).toBe(false)
    expect(isFeatureEnabledForUser('emojiReactions', 'user-99')).toBe(false)

    // Restore
    engagementFlagRegistry.emojiReactions = original
  })

  it('uses consistent hashing — same flag + user always yields same result', () => {
    const flag = 'venueComparison'
    const userId = 'stable-user-id-abc'
    const result1 = isFeatureEnabledForUser(flag, userId)
    const result2 = isFeatureEnabledForUser(flag, userId)
    expect(result1).toBe(result2)
  })

  it('different users can get different results at partial rollout', () => {
    const original = { ...engagementFlagRegistry.venueEnergyTimeline }
    // Use 50% rollout to maximize the chance of split results
    engagementFlagRegistry.venueEnergyTimeline = { ...original, rolloutPercentage: 50 }

    const results = Array.from({ length: 20 }, (_, i) =>
      isFeatureEnabledForUser('venueEnergyTimeline', `user-${i}`)
    )
    const trueCount = results.filter(Boolean).length

    // With 20 users and 50% rollout, we expect some true and some false
    expect(trueCount).toBeGreaterThan(0)
    expect(trueCount).toBeLessThan(20)

    engagementFlagRegistry.venueEnergyTimeline = original
  })

  it('falls back to legacy featureFlags for known FeatureFlag keys', () => {
    // 'integrations', 'socialDashboard', 'smartMap' are in featureFlags
    const result = isFeatureEnabledForUser('integrations', 'user-1')
    expect(result).toBe(featureFlags.integrations)
  })
})

// ---------------------------------------------------------------------------
// 4. Override mechanism
// ---------------------------------------------------------------------------

describe('setFeatureOverride / clearFeatureOverrides / getAllOverrides', () => {
  it('setFeatureOverride stores override in localStorage', () => {
    setFeatureOverride('tonightsPickCard', false)
    expect(ls.getItem('ff_override_tonightsPickCard')).toBe('false')
  })

  it('override takes priority: false override disables even a fully-enabled flag', () => {
    setFeatureOverride('liveActivityFeed', false)
    // liveActivityFeed is at 100% rollout, but override wins
    expect(isFeatureEnabledForUser('liveActivityFeed', 'any-user')).toBe(false)
  })

  it('override takes priority: true override enables even if rolloutPercentage is 0', () => {
    const original = { ...engagementFlagRegistry.goingTonight }
    engagementFlagRegistry.goingTonight = { ...original, rolloutPercentage: 0 }

    setFeatureOverride('goingTonight', true)
    expect(isFeatureEnabledForUser('goingTonight', 'any-user')).toBe(true)

    engagementFlagRegistry.goingTonight = original
  })

  it('getAllOverrides returns all currently set overrides', () => {
    setFeatureOverride('streakRewards', true)
    setFeatureOverride('offlineMode', false)

    const overrides = getAllOverrides()
    expect(overrides).toEqual({
      streakRewards: true,
      offlineMode: false,
    })
  })

  it('clearFeatureOverrides removes all override keys', () => {
    setFeatureOverride('streakRewards', true)
    setFeatureOverride('venueComparison', false)
    setFeatureOverride('neighborhoodWalkthrough', true)

    clearFeatureOverrides()

    const overrides = getAllOverrides()
    expect(Object.keys(overrides)).toHaveLength(0)
  })

  it('clearFeatureOverrides only removes ff_override_ prefixed keys', () => {
    ls.setItem('some_other_key', 'preserved')
    setFeatureOverride('venueQuickBoost', true)

    clearFeatureOverrides()

    expect(ls.getItem('some_other_key')).toBe('preserved')
    expect(ls.getItem('ff_override_venueQuickBoost')).toBeNull()
  })

  it('getAllOverrides returns empty object when no overrides are set', () => {
    expect(getAllOverrides()).toEqual({})
  })

  it('override can be re-set to a different value', () => {
    setFeatureOverride('emojiReactions', false)
    expect(isFeatureEnabledForUser('emojiReactions', 'user-1')).toBe(false)

    setFeatureOverride('emojiReactions', true)
    expect(isFeatureEnabledForUser('emojiReactions', 'user-1')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. Legacy isFeatureEnabled (env-var driven)
// ---------------------------------------------------------------------------

describe('isFeatureEnabled (legacy)', () => {
  it('returns the value from featureFlags for a known flag', () => {
    expect(isFeatureEnabled('integrations')).toBe(featureFlags.integrations)
    expect(isFeatureEnabled('socialDashboard')).toBe(featureFlags.socialDashboard)
    expect(isFeatureEnabled('smartMap')).toBe(featureFlags.smartMap)
  })
})

// ---------------------------------------------------------------------------
// 6. Priority ordering
// ---------------------------------------------------------------------------

describe('Priority: override > global kill > rollout hash', () => {
  it('override (false) beats global enabled + 100% rollout', () => {
    setFeatureOverride('venueEnergyTimeline', false)
    // venueEnergyTimeline is enabled: true, 100% rollout
    expect(isFeatureEnabledForUser('venueEnergyTimeline', 'user-abc')).toBe(false)
  })

  it('global kill (enabled: false) beats rollout hash at 100%', () => {
    const original = { ...engagementFlagRegistry.venueComparison }
    engagementFlagRegistry.venueComparison = { ...original, enabled: false, rolloutPercentage: 100 }

    expect(isFeatureEnabledForUser('venueComparison', 'user-xyz')).toBe(false)

    engagementFlagRegistry.venueComparison = original
  })

  it('override (true) beats global kill (enabled: false)', () => {
    const original = { ...engagementFlagRegistry.neighborhoodWalkthrough }
    engagementFlagRegistry.neighborhoodWalkthrough = { ...original, enabled: false }

    setFeatureOverride('neighborhoodWalkthrough', true)
    expect(isFeatureEnabledForUser('neighborhoodWalkthrough', 'user-1')).toBe(true)

    engagementFlagRegistry.neighborhoodWalkthrough = original
  })
})
