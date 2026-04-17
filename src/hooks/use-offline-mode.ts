'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Venue } from '@/lib/types'

export interface QueuedAction {
  id: string
  type: 'checkin' | 'reaction' | 'pulse'
  payload: Record<string, unknown>
  createdAt: number
}

interface OfflineModeState {
  isOffline: boolean
  lastOnline: Date | null
  cachedVenues: Venue[]
  queuedActions: QueuedAction[]
  addToQueue: (action: QueuedAction) => void
  processQueue: () => void
}

const CACHED_VENUES_KEY = 'pulse_cached_venues'
const QUEUED_ACTIONS_KEY = 'pulse_queued_actions'
const LAST_ONLINE_KEY = 'pulse_last_online'

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return fallback
    return JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage may be full or unavailable
  }
}

function loadLastOnline(): Date | null {
  try {
    const stored = localStorage.getItem(LAST_ONLINE_KEY)
    if (stored === null) return null
    const timestamp = Number(stored)
    if (Number.isNaN(timestamp)) return null
    return new Date(timestamp)
  } catch {
    return null
  }
}

function saveLastOnline(date: Date): void {
  try {
    localStorage.setItem(LAST_ONLINE_KEY, String(date.getTime()))
  } catch {
    // localStorage may be unavailable
  }
}

export function useOfflineMode(): OfflineModeState {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return !navigator.onLine
    }
    return false
  })

  const [lastOnline, setLastOnline] = useState<Date | null>(() => loadLastOnline())

  const [cachedVenues, _setCachedVenues] = useState<Venue[]>(() =>
    loadFromStorage<Venue[]>(CACHED_VENUES_KEY, [])
  )

  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>(() =>
    loadFromStorage<QueuedAction[]>(QUEUED_ACTIONS_KEY, [])
  )

  const processQueueRef = useRef<(() => void) | null>(null)

  // Monitor online/offline status
  useEffect(() => {
    function handleOnline(): void {
      setIsOffline(false)
      const now = new Date()
      setLastOnline(now)
      saveLastOnline(now)

      // Process queued actions when back online
      if (processQueueRef.current) {
        processQueueRef.current()
      }
    }

    function handleOffline(): void {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Record initial online time
    if (navigator.onLine) {
      const now = new Date()
      setLastOnline(now)
      saveLastOnline(now)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Persist cached venues when they change
  useEffect(() => {
    saveToStorage(CACHED_VENUES_KEY, cachedVenues)
  }, [cachedVenues])

  // Persist queued actions when they change
  useEffect(() => {
    saveToStorage(QUEUED_ACTIONS_KEY, queuedActions)
  }, [queuedActions])

  const addToQueue = useCallback((action: QueuedAction): void => {
    setQueuedActions((prev) => [...prev, action])
  }, [])

  const processQueue = useCallback((): void => {
    // In a real implementation, this would send queued actions to the server.
    // For now, we clear the queue to indicate processing is complete.
    setQueuedActions([])
    saveToStorage(QUEUED_ACTIONS_KEY, [])
  }, [])

  // Keep ref in sync for use in event handlers
  processQueueRef.current = processQueue

  return {
    isOffline,
    lastOnline,
    cachedVenues,
    queuedActions,
    addToQueue,
    processQueue,
  }
}
