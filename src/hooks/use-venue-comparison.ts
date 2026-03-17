import { useMemo, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import type { Venue } from '@/lib/types'
import {
  compareVenues,
  type VenueComparisonResult,
} from '@/lib/venue-comparison'

interface ComparisonState {
  venueA: Venue | null
  venueB: Venue | null
}

const INITIAL_STATE: ComparisonState = {
  venueA: null,
  venueB: null,
}

export function useVenueComparison(
  userLocation?: { lat: number; lng: number },
  friendsAtVenue?: (venueId: string) => number
) {
  const [state, setState] = useKV<ComparisonState>(
    'venue-comparison',
    INITIAL_STATE
  )

  const safeState = state ?? INITIAL_STATE

  const selectedVenues: [Venue | null, Venue | null] = [
    safeState.venueA,
    safeState.venueB,
  ]

  const isComparing = safeState.venueA !== null && safeState.venueB !== null

  const selectVenueForComparison = useCallback(
    (venue: Venue) => {
      setState((current) => {
        const s = current ?? INITIAL_STATE
        // If venue already selected, do nothing
        if (s.venueA?.id === venue.id || s.venueB?.id === venue.id) return s
        // Fill first empty slot
        if (s.venueA === null) return { ...s, venueA: venue }
        if (s.venueB === null) return { ...s, venueB: venue }
        // Both full: replace oldest (slot A), shift B to A
        return { venueA: s.venueB, venueB: venue }
      })
    },
    [setState]
  )

  const removeVenue = useCallback(
    (index: 0 | 1) => {
      setState((current) => {
        const s = current ?? INITIAL_STATE
        if (index === 0) return { ...s, venueA: null }
        return { ...s, venueB: null }
      })
    },
    [setState]
  )

  const clearComparison = useCallback(() => {
    setState(INITIAL_STATE)
  }, [setState])

  const swapVenues = useCallback(() => {
    setState((current) => {
      const s = current ?? INITIAL_STATE
      return { venueA: s.venueB, venueB: s.venueA }
    })
  }, [setState])

  const comparisonResult: VenueComparisonResult | null = useMemo(() => {
    if (!safeState.venueA || !safeState.venueB) return null
    const friendsA = friendsAtVenue
      ? friendsAtVenue(safeState.venueA.id)
      : 0
    const friendsB = friendsAtVenue
      ? friendsAtVenue(safeState.venueB.id)
      : 0
    return compareVenues(
      safeState.venueA,
      safeState.venueB,
      userLocation,
      friendsA,
      friendsB
    )
  }, [safeState.venueA, safeState.venueB, userLocation, friendsAtVenue])

  return {
    selectedVenues,
    isComparing,
    comparisonResult,
    selectVenueForComparison,
    removeVenue,
    clearComparison,
    swapVenues,
  }
}
