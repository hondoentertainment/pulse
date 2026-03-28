/**
 * Production Feature Flag System
 *
 * Supports:
 * - Static defaults per flag
 * - Env var overrides (VITE_FF_<SCREAMING_SNAKE_CASE>=true/false)
 * - Gradual rollout by hashing user ID (0-100 percentage)
 * - Per-user allowlist for internal testers
 * - React hook: useFeatureFlag(flag)
 * - React component: <FeatureGate flag="crews">...</FeatureGate>
 */

import { type ReactNode, type ReactElement, createElement, useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeatureFlag =
  | 'integrations'
  | 'socialDashboard'
  | 'smartMap'
  | 'stories'
  | 'crews'
  | 'events'
  | 'nightPlanner'
  | 'venueOwnerDashboard'
  | 'creatorEconomy'
  | 'achievements'
  | 'offlineMode'
  | 'realtimeScores'
  | 'pushNotifications'
  | 'videoUploads'

export interface FlagConfig {
  /** Master on/off switch. */
  enabled: boolean
  /** Gradual rollout percentage 0–100. Only applied when enabled is true. */
  rolloutPercentage?: number
  /** User IDs that always receive the feature regardless of rollout %. */
  allowlist?: string[]
  /** Human-readable description for dashboards / runbooks. */
  description: string
}

// ---------------------------------------------------------------------------
// Default flag definitions
// ---------------------------------------------------------------------------

const DEFAULT_FLAGS: Record<FeatureFlag, FlagConfig> = {
  integrations: {
    enabled: false,
    description: 'Third-party integrations (Spotify, Uber, Lyft)',
  },
  socialDashboard: {
    enabled: false,
    description: 'X/Twitter social pulse correlation',
  },
  smartMap: {
    enabled: true,
    description: 'Advanced map features (heatmap, clustering)',
  },
  stories: {
    enabled: true,
    description: 'Venue and user stories',
  },
  crews: {
    enabled: true,
    description: 'Group check-ins and coordination',
  },
  events: {
    enabled: true,
    description: 'Venue events and tickets',
  },
  nightPlanner: {
    enabled: false,
    description: 'Night planning and suggestions',
  },
  venueOwnerDashboard: {
    enabled: false,
    description: 'Venue owner management tools',
  },
  creatorEconomy: {
    enabled: false,
    description: 'Creator tools and metrics',
  },
  achievements: {
    enabled: true,
    description: 'Badges, streaks, milestones',
  },
  offlineMode: {
    enabled: true,
    description: 'Offline queue and sync',
  },
  realtimeScores: {
    enabled: true,
    description: 'Live venue score updates via Supabase Realtime',
  },
  pushNotifications: {
    enabled: false,
    description: 'Push notification support',
  },
  videoUploads: {
    enabled: false,
    rolloutPercentage: 25,
    description: 'Video uploads in pulses',
  },
}

// ---------------------------------------------------------------------------
// Env-var override helpers
// ---------------------------------------------------------------------------

/**
 * Convert a camelCase flag name to SCREAMING_SNAKE_CASE.
 * e.g. "videoUploads" → "VIDEO_UPLOADS"
 */
function toScreamingSnake(flag: string): string {
  return flag.replace(/([A-Z])/g, '_$1').toUpperCase()
}

function parseEnvBool(value: unknown): boolean | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return null
}

function getEnvOverride(flag: FeatureFlag): boolean | null {
  const key = `VITE_FF_${toScreamingSnake(flag)}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env
  return parseEnvBool(env?.[key])
}

// ---------------------------------------------------------------------------
// Stable user-bucket hash (djb2 variant, returns 0–99)
// ---------------------------------------------------------------------------

function hashUserId(userId: string, flag: FeatureFlag): number {
  const input = `${flag}:${userId}`
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
    hash = hash >>> 0 // keep unsigned 32-bit
  }
  return hash % 100
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a feature flag is enabled for a given user.
 *
 * Resolution order:
 * 1. Env var override (VITE_FF_<FLAG>) – explicit true/false wins immediately
 * 2. Allowlist – if userId is in the allowlist, always enabled
 * 3. Master toggle – if `enabled` is false (and no env override), disabled
 * 4. Rollout percentage – deterministic hash of userId + flag name
 */
export function isFeatureEnabled(flag: FeatureFlag, userId?: string): boolean {
  const config = DEFAULT_FLAGS[flag]

  // 1. Env var override
  const envOverride = getEnvOverride(flag)
  if (envOverride !== null) return envOverride

  // 2. Allowlist
  if (userId && config.allowlist?.includes(userId)) return true

  // 3. Master toggle
  if (!config.enabled) return false

  // 4. Rollout percentage
  if (config.rolloutPercentage !== undefined && userId) {
    return hashUserId(userId, flag) < config.rolloutPercentage
  }

  // If rolloutPercentage is set but no userId, default to disabled for safety
  if (config.rolloutPercentage !== undefined && !userId) {
    return false
  }

  return true
}

/**
 * Return a snapshot of all flag states for a given user (useful for logging /
 * debugging).
 */
export function getAllFlags(userId?: string): Record<FeatureFlag, boolean> {
  return Object.fromEntries(
    (Object.keys(DEFAULT_FLAGS) as FeatureFlag[]).map((flag) => [
      flag,
      isFeatureEnabled(flag, userId),
    ])
  ) as Record<FeatureFlag, boolean>
}

/**
 * Return the full FlagConfig for inspection (does not apply overrides).
 */
export function getFlagConfig(flag: FeatureFlag): FlagConfig {
  return DEFAULT_FLAGS[flag]
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook that returns whether a feature flag is enabled for the current
 * user.  Reads userId from localStorage key `pulse_user_id` if available so
 * rollout percentages are stable across page loads.
 *
 * @example
 * const crewsEnabled = useFeatureFlag('crews')
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const userId = getUserIdFromStorage()
    return isFeatureEnabled(flag, userId)
  })

  useEffect(() => {
    const userId = getUserIdFromStorage()
    setEnabled(isFeatureEnabled(flag, userId))
  }, [flag])

  return enabled
}

function getUserIdFromStorage(): string | undefined {
  try {
    return localStorage.getItem('pulse_user_id') ?? undefined
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

interface FeatureGateProps {
  flag: FeatureFlag
  children: ReactNode
  /** Content rendered when the flag is disabled. Defaults to null. */
  fallback?: ReactNode
}

/**
 * Conditionally renders children based on a feature flag.
 *
 * @example
 * <FeatureGate flag="crews" fallback={<ComingSoon />}>
 *   <CrewPage />
 * </FeatureGate>
 */
export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps): ReactElement {
  const enabled = useFeatureFlag(flag)
  return createElement(
    'span',
    { style: { display: 'contents' } },
    enabled ? children : fallback
  ) as ReactElement
}
