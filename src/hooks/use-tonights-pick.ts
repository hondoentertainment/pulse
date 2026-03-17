import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useKV } from '@github/spark/hooks'
import type { Venue, User, Pulse } from '@/lib/types'
import {
  pickTonightsVenue,
  refreshPick,
  shouldShowPick,
  type TonightsPick,
  type PickParams,
} from '@/lib/tonights-pick'
import { getFriendActivity } from '@/lib/venue-recommendations'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const DISMISS_KEY = 'tonightsPickDismissedDate'

export function useTonightsPick(
  venues: Venue[],
  user: User | null,
  pulses: Pulse[],
  userLocation: { lat: number; lng: number } | null,
) {
  const [pick, setPick] = useState<TonightsPick | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAlternates, setShowAlternates] = useState(false)
  const [dismissedDate, setDismissedDate] = useKV<string | null>(DISMISS_KEY, null)
  const pickRef = useRef<TonightsPick | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check if dismissed for today
  const isDismissed = useMemo(() => {
    if (!dismissedDate) return false
    const today = new Date().toISOString().slice(0, 10)
    return dismissedDate === today
  }, [dismissedDate])

  // Build pick params
  const buildParams = useCallback((): PickParams | null => {
    if (!user || venues.length === 0) return null

    const friendActivity = getFriendActivity(user, pulses)
    const recentCheckins = Object.keys(user.venueCheckInHistory ?? {})

    return {
      venues,
      user,
      userLocation,
      currentTime: new Date(),
      friendActivity,
      recentCheckins,
    }
  }, [venues, user, pulses, userLocation])

  // Compute pick
  const computePick = useCallback(() => {
    const now = new Date()
    if (!shouldShowPick(now) || isDismissed) {
      setPick(null)
      setIsLoading(false)
      return
    }

    const params = buildParams()
    if (!params) {
      setPick(null)
      setIsLoading(false)
      return
    }

    // If we already have a pick, check if refresh is needed
    if (pickRef.current) {
      const { shouldRefresh, newPick } = refreshPick(pickRef.current, params)
      if (shouldRefresh && newPick) {
        pickRef.current = newPick
        setPick(newPick)
      }
    } else {
      const newPick = pickTonightsVenue(params)
      pickRef.current = newPick
      setPick(newPick)
    }

    setIsLoading(false)
  }, [buildParams, isDismissed])

  // Initial computation and interval
  useEffect(() => {
    computePick()

    intervalRef.current = setInterval(computePick, REFRESH_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [computePick])

  // Dismiss for tonight
  const dismiss = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    setDismissedDate(today)
    setPick(null)
    pickRef.current = null
  }, [setDismissedDate])

  // Force refresh
  const refresh = useCallback(() => {
    pickRef.current = null
    setIsLoading(true)
    computePick()
  }, [computePick])

  // Toggle alternates
  const toggleAlternates = useCallback(() => {
    setShowAlternates((prev) => !prev)
  }, [])

  return {
    pick,
    isLoading,
    isDismissed,
    showAlternates,
    dismiss,
    refresh,
    toggleAlternates,
  }
}
