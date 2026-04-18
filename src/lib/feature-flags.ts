export type FeatureFlag = 'integrations' | 'socialDashboard' | 'smartMap'

export type EngagementFlag =
  | 'tonightsPickCard'
  | 'liveActivityFeed'
  | 'goingTonight'
  | 'emojiReactions'
  | 'venueEnergyTimeline'
  | 'venueComparison'
  | 'streakRewards'
  | 'neighborhoodWalkthrough'
  | 'venueQuickBoost'
  | 'offlineMode'

export type AnyFlag = FeatureFlag | EngagementFlag

export interface FeatureFlagConfig {
  enabled: boolean
  rolloutPercentage: number
  description: string
}

type FeatureFlagMap = Record<FeatureFlag, boolean>

function parseFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

const defaults: FeatureFlagMap = {
  integrations: true,
  socialDashboard: true,
  smartMap: true,
}

export const featureFlags: FeatureFlagMap = {
  integrations: parseFlag(import.meta.env.VITE_FF_ENABLE_INTEGRATIONS, defaults.integrations),
  socialDashboard: parseFlag(import.meta.env.VITE_FF_ENABLE_SOCIAL_DASHBOARD, defaults.socialDashboard),
  smartMap: parseFlag(import.meta.env.VITE_FF_ENABLE_SMART_MAP, defaults.smartMap),
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag]
}

// ---------------------------------------------------------------------------
// Engagement Feature Flag Registry
// ---------------------------------------------------------------------------

export const engagementFlagRegistry: Record<EngagementFlag, FeatureFlagConfig> = {
  tonightsPickCard: {
    enabled: true,
    rolloutPercentage: 100,
    description: "Personalized venue recommendation card for tonight's outing",
  },
  liveActivityFeed: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Real-time stream of check-ins, surges, and trending activity',
  },
  goingTonight: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'RSVP system showing which friends are going to which venues tonight',
  },
  emojiReactions: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Tap-to-react emoji system with burst animation and velocity tracking',
  },
  venueEnergyTimeline: {
    enabled: true,
    rolloutPercentage: 100,
    description: '24-hour energy history chart showing peak hours and current trend',
  },
  venueComparison: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Side-by-side venue comparison across energy, distance, and vibe metrics',
  },
  streakRewards: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Check-in streak tracking with milestones and XP multipliers',
  },
  neighborhoodWalkthrough: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Curated bar crawl routes through neighborhoods by theme',
  },
  venueQuickBoost: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Venue owner tool to temporarily boost pulse score visibility',
  },
  offlineMode: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Smart prefetching and offline cache for no-network venue browsing',
  },
}

// ---------------------------------------------------------------------------
// Consistent hashing for rollout
// ---------------------------------------------------------------------------

/**
 * Produces a deterministic integer in [0, 99] from an arbitrary string.
 * Uses the djb2 hash algorithm — fast, no crypto needed, same result every call.
 */
export function hashToPercent(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
    // Keep it within 32-bit signed integer range
    hash = hash | 0
  }
  // Map to [0, 99]
  return Math.abs(hash) % 100
}

/**
 * Determines whether a specific user should see a given engagement feature.
 * Uses consistent hashing so the same user always gets the same result for
 * the same flag, regardless of when or how often the function is called.
 *
 * Priority order:
 *   1. localStorage override (set via setFeatureOverride)
 *   2. Flag disabled globally (enabled: false)
 *   3. Rollout percentage via hash of flagName + userId
 */
export function isFeatureEnabledForUser(flagName: string, userId: string): boolean {
  // 1. Check localStorage override
  const override = getFeatureOverride(flagName)
  if (override !== null) {
    return override
  }

  // 2. Look up registry
  const config = engagementFlagRegistry[flagName as EngagementFlag]
  if (!config) {
    // Fall back to legacy featureFlags for FeatureFlag keys
    if (flagName in featureFlags) {
      return featureFlags[flagName as FeatureFlag]
    }
    return false
  }

  // 3. Global kill switch
  if (!config.enabled) {
    return false
  }

  // 4. Rollout percentage via consistent hash
  const bucket = hashToPercent(flagName + userId)
  return bucket < config.rolloutPercentage
}

// ---------------------------------------------------------------------------
// Override mechanism (localStorage-backed, dev/testing)
// ---------------------------------------------------------------------------

const OVERRIDE_KEY_PREFIX = 'ff_override_'

function overrideKey(flagName: string): string {
  return OVERRIDE_KEY_PREFIX + flagName
}

/**
 * Reads an override value from localStorage.
 * Returns null if no override is set.
 */
function getFeatureOverride(flagName: string): boolean | null {
  try {
    const raw = localStorage.getItem(overrideKey(flagName))
    if (raw === null) return null
    return raw === 'true'
  } catch {
    return null
  }
}

/**
 * Stores a per-flag override in localStorage.
 * Overrides take priority over rollout percentage checks.
 */
export function setFeatureOverride(flagName: string, enabled: boolean): void {
  try {
    localStorage.setItem(overrideKey(flagName), String(enabled))
  } catch {
    // localStorage may be unavailable (e.g. in tests without jsdom)
  }
}

/**
 * Removes all feature flag overrides from localStorage.
 */
export function clearFeatureOverrides(): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(OVERRIDE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Returns all currently active overrides as a record of flagName -> enabled.
 */
export function getAllOverrides(): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(OVERRIDE_KEY_PREFIX)) {
        const flagName = key.slice(OVERRIDE_KEY_PREFIX.length)
        result[flagName] = localStorage.getItem(key) === 'true'
      }
    }
  } catch {
    // localStorage may be unavailable
  }
  return result
}
