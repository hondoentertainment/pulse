'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Venue } from '@/lib/types'
import type { CacheStats, CacheInstance } from '@/lib/offline-cache'
import {
  createCache,
  getCacheStats,
  cleanupExpired,
  persistCache,
  loadCache,
} from '@/lib/offline-cache'
import type { VenueOfflineData } from '@/lib/smart-prefetch'
import {
  determinePrefetchTargets,
  buildPrefetchPlan,
  prefetchVenueData,
  getOfflineVenues,
} from '@/lib/smart-prefetch'
import type { QueuedAction } from './use-offline-mode'

const QUEUED_ACTIONS_KEY = 'pulse_offline_queued_actions'

function loadQueuedActions(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUED_ACTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueuedActions(actions: QueuedAction[]): void {
  try {
    localStorage.setItem(QUEUED_ACTIONS_KEY, JSON.stringify(actions))
  } catch {
    // Storage may be full
  }
}

export interface UseOfflineCacheReturn {
  isOnline: boolean
  cachedVenues: VenueOfflineData[]
  lastSyncTime: number | null
  cacheStats: CacheStats
  queuedActions: QueuedAction[]
  syncProgress: { total: number; synced: number } | null
  forcePrefetch: () => void
  clearCache: () => void
  queueAction: (action: QueuedAction) => void
}

export function useOfflineCache(
  venues: Venue[] = [],
  userLocation: { lat: number; lng: number } | null = null,
  favorites: string[] = [],
  followed: string[] = []
): UseOfflineCacheReturn {
  const cacheRef = useRef<CacheInstance>(loadCache())
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') return navigator.onLine
    return true
  })
  const [cachedVenues, setCachedVenues] = useState<VenueOfflineData[]>([])
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats>(() => getCacheStats(cacheRef.current))
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>(() => loadQueuedActions())
  const [syncProgress, setSyncProgress] = useState<{ total: number; synced: number } | null>(null)

  // Refresh derived state from cache
  const refreshCacheState = useCallback(() => {
    setCacheStats(getCacheStats(cacheRef.current))
    if (userLocation) {
      setCachedVenues(getOfflineVenues(cacheRef.current, userLocation))
    }
  }, [userLocation])

  // Prefetch venues into the cache
  const runPrefetch = useCallback(() => {
    if (!userLocation || venues.length === 0) return

    const targets = determinePrefetchTargets({
      userLocation,
      venues,
      favorites,
      followed,
      currentTime: Date.now(),
    })

    const plan = buildPrefetchPlan(targets, cacheRef.current)

    for (const target of plan.toFetch) {
      prefetchVenueData(target.venue, cacheRef.current, target.priority)
    }

    // Persist to localStorage
    persistCache(cacheRef.current)
    setLastSyncTime(Date.now())
    refreshCacheState()
  }, [userLocation, venues, favorites, followed, refreshCacheState])

  // Force prefetch (exposed to consumers)
  const forcePrefetch = useCallback(() => {
    runPrefetch()
  }, [runPrefetch])

  // Clear all cached data
  const clearCache = useCallback(() => {
    cacheRef.current = createCache()
    persistCache(cacheRef.current)
    setCachedVenues([])
    setCacheStats(getCacheStats(cacheRef.current))
    setLastSyncTime(null)
  }, [])

  // Queue an offline action
  const queueAction = useCallback((action: QueuedAction) => {
    setQueuedActions((prev) => {
      const next = [...prev, action]
      saveQueuedActions(next)
      return next
    })
  }, [])

  // Process queued actions when back online
  const processQueuedActions = useCallback(() => {
    if (queuedActions.length === 0) return

    const total = queuedActions.length
    setSyncProgress({ total, synced: 0 })

    // Simulate sync processing (in production, would send to API)
    let synced = 0
    const interval = setInterval(() => {
      synced++
      setSyncProgress({ total, synced })
      if (synced >= total) {
        clearInterval(interval)
        setQueuedActions([])
        saveQueuedActions([])
        setTimeout(() => setSyncProgress(null), 1500)
      }
    }, 300)
  }, [queuedActions])

  // Monitor connectivity
  useEffect(() => {
    function handleOnline(): void {
      setIsOnline(true)
      // Re-prefetch when connectivity restored
      runPrefetch()
    }

    function handleOffline(): void {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [runPrefetch])

  // Process queued actions when coming back online
  useEffect(() => {
    if (isOnline && queuedActions.length > 0) {
      processQueuedActions()
    }
  }, [isOnline, processQueuedActions])

  // Auto-prefetch on mount
  useEffect(() => {
    runPrefetch()
  }, [runPrefetch])

  // Periodic cleanup of expired entries
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupExpired(cacheRef.current)
      persistCache(cacheRef.current)
      refreshCacheState()
    }, 5 * 60 * 1000) // Every 5 minutes

    return () => clearInterval(interval)
  }, [refreshCacheState])

  return {
    isOnline,
    cachedVenues,
    lastSyncTime,
    cacheStats,
    queuedActions,
    syncProgress,
    forcePrefetch,
    clearCache,
    queueAction,
  }
}
