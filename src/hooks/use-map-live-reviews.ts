import { useCallback, useEffect, useRef, useState } from 'react'
import type { Pulse, Venue } from '@/lib/types'
import {
  collectLiveReviewArrivals,
  type MapLiveToast,
} from '@/lib/map-live-reviews'

export function useMapLiveReviews(pulses: Pulse[], venues: Venue[]) {
  const seenRef = useRef<Set<string>>(new Set())
  const primedRef = useRef(false)
  const [toast, setToast] = useState<MapLiveToast | null>(null)

  useEffect(() => {
    const { nextSeen, nextPrimed, arrivals } = collectLiveReviewArrivals(
      seenRef.current,
      primedRef.current,
      pulses,
      venues,
    )
    seenRef.current = nextSeen
    primedRef.current = nextPrimed
    if (arrivals.length === 0) return
    setToast(arrivals[0])
  }, [pulses, venues])

  const dismissToast = useCallback(() => setToast(null), [])

  return {
    toast,
    dismissToast,
  }
}
