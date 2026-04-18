import { useCallback, useEffect, useState } from 'react'
import { useKV } from '@github/spark/hooks'
import {
  isFeatureEnabled,
  isFeatureEnabledForUser,
  setFeatureOverride as _setFeatureOverride,
  clearFeatureOverrides as _clearFeatureOverrides,
  getAllOverrides,
  type FeatureFlag,
  type AnyFlag,
} from '@/lib/feature-flags'
import type { User } from '@/lib/types'

/**
 * Returns whether a legacy FeatureFlag is enabled (env-var driven).
 * Kept for backward compatibility.
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return isFeatureEnabled(flag)
}

/**
 * Returns whether an engagement feature flag is enabled for the current user.
 * Integrates with the userId-based consistent hashing rollout and localStorage
 * overrides. Falls back gracefully when no user is loaded yet.
 */
export function useEngagementFlag(flagName: AnyFlag): boolean {
  const [currentUser] = useKV<User>('currentUser', { id: '', username: '', friends: [], createdAt: '' })
  const userId = currentUser?.id ?? ''
  return isFeatureEnabledForUser(flagName, userId)
}

/**
 * Hook for the admin panel — exposes override controls and re-renders when
 * overrides change.
 */
export function useFeatureFlagAdmin() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>(getAllOverrides)

  const refresh = useCallback(() => {
    setOverrides(getAllOverrides())
  }, [])

  const setOverride = useCallback((flagName: string, enabled: boolean) => {
    _setFeatureOverride(flagName, enabled)
    refresh()
  }, [refresh])

  const clearOverrides = useCallback(() => {
    _clearFeatureOverrides()
    refresh()
  }, [refresh])

  // Sync state if localStorage changes from another tab
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [refresh])

  return { overrides, setOverride, clearOverrides }
}
