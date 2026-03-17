import { useState, useMemo, useCallback } from 'react'
import type { Venue } from '@/lib/types'
import {
  type ActiveBoost,
  type BoostType,
  createBoost as createBoostFn,
  getActiveBoosts,
  canBoost,
  getRecommendedBoostType,
  isBoostActive,
} from '@/lib/venue-quick-boost'

/**
 * Hook for managing venue quick boosts.
 *
 * Provides boost creation, cancellation, active/history tracking,
 * and recommendations.
 */
export function useVenueBoost(venue?: Venue) {
  const [allBoosts, setAllBoosts] = useState<ActiveBoost[]>([])

  /** All currently active boosts (across all venues). */
  const activeBoosts = useMemo(() => {
    const now = new Date()
    return allBoosts.filter(b => isBoostActive(b, now) && b.status !== 'expired')
  }, [allBoosts])

  /** Past boosts (expired or cancelled). */
  const boostHistory = useMemo(() => {
    const now = new Date()
    return allBoosts.filter(b => !isBoostActive(b, now) || b.status === 'expired')
  }, [allBoosts])

  /** Check if a specific venue can be boosted (max 2 concurrent). */
  const canBoostVenue = useCallback(
    (venueId: string): boolean => canBoost(venueId, allBoosts),
    [allBoosts]
  )

  /** Recommended boost type for the current venue. */
  const recommendedType = useMemo((): BoostType | null => {
    if (!venue) return null
    const now = new Date()
    return getRecommendedBoostType(venue, now, now.getDay())
  }, [venue])

  /** Create and launch a new boost. */
  const createBoost = useCallback(
    (venueId: string, type: BoostType, duration: number): ActiveBoost | null => {
      if (!canBoost(venueId, allBoosts)) return null
      const boost = createBoostFn(venueId, type, duration)
      setAllBoosts(prev => [...prev, boost])
      return boost
    },
    [allBoosts]
  )

  /** Cancel an active boost by id. */
  const cancelBoost = useCallback(
    (boostId: string): void => {
      setAllBoosts(prev =>
        prev.map(b =>
          b.id === boostId ? { ...b, status: 'expired' as const } : b
        )
      )
    },
    []
  )

  /** Get active boosts for a specific venue. */
  const getVenueActiveBoosts = useCallback(
    (venueId: string): ActiveBoost[] => getActiveBoosts(venueId, allBoosts),
    [allBoosts]
  )

  return {
    allBoosts,
    activeBoosts,
    boostHistory,
    canBoostVenue,
    recommendedType,
    createBoost,
    cancelBoost,
    getVenueActiveBoosts,
  }
}
