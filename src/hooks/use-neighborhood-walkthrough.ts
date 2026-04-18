import { useCallback, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import type { Venue } from '@/lib/types'
import type {
  WalkthroughRoute,
  WalkthroughTheme,
  GenerateWalkthroughParams,
} from '@/lib/neighborhood-walkthrough'
import {
  generateWalkthrough,
  getAvailableThemes,
} from '@/lib/neighborhood-walkthrough'

interface WalkthroughState {
  route: WalkthroughRoute | null
  currentStopIndex: number
  isActive: boolean
  visitedStops: string[]
  startedAt: string | null
}

const DEFAULT_STATE: WalkthroughState = {
  route: null,
  currentStopIndex: 0,
  isActive: false,
  visitedStops: [],
  startedAt: null,
}

export function useNeighborhoodWalkthrough(
  venues: Venue[],
  userLocation: { lat: number; lng: number } | null
) {
  const [state, setState] = useKV<WalkthroughState>('walkthrough-state', DEFAULT_STATE)

  const activeRoute = state?.route ?? null
  const currentStopIndex = state?.currentStopIndex ?? 0
  const isActive = state?.isActive ?? false

  const generateRoute = useCallback(
    (neighborhood: string, theme?: WalkthroughTheme) => {
      if (!userLocation) return null

      const params: GenerateWalkthroughParams = {
        venues,
        neighborhood,
        userLocation,
        theme,
      }

      const route = generateWalkthrough(params)

      setState({
        route,
        currentStopIndex: 0,
        isActive: false,
        visitedStops: [],
        startedAt: null,
      })

      return route
    },
    [venues, userLocation, setState]
  )

  const startWalkthrough = useCallback(() => {
    if (!state?.route) return

    setState({
      ...state,
      isActive: true,
      currentStopIndex: 0,
      startedAt: new Date().toISOString(),
    })
  }, [state, setState])

  const advanceToNext = useCallback(() => {
    if (!state?.route || !state.isActive) return

    const nextIndex = state.currentStopIndex + 1
    const currentVenueId = state.route.stops[state.currentStopIndex]?.venue.id

    if (nextIndex >= state.route.stops.length) {
      // Route complete
      setState({
        ...state,
        currentStopIndex: nextIndex,
        visitedStops: currentVenueId
          ? [...state.visitedStops, currentVenueId]
          : state.visitedStops,
        isActive: false,
      })
      return
    }

    setState({
      ...state,
      currentStopIndex: nextIndex,
      visitedStops: currentVenueId
        ? [...state.visitedStops, currentVenueId]
        : state.visitedStops,
    })
  }, [state, setState])

  const endWalkthrough = useCallback(() => {
    setState(DEFAULT_STATE)
  }, [setState])

  const estimatedCompletion = useMemo(() => {
    if (!activeRoute || !isActive) return null

    const remainingStops = activeRoute.stops.slice(currentStopIndex)
    const remainingWalkTime = remainingStops.reduce(
      (sum, stop) => sum + stop.walkTimeFromPrevious,
      0
    )
    // Add ~30 min dwell time per remaining stop
    const remainingDwellTime = remainingStops.length * 30
    const totalRemainingMinutes = remainingWalkTime + remainingDwellTime

    return new Date(Date.now() + totalRemainingMinutes * 60 * 1000)
  }, [activeRoute, isActive, currentStopIndex])

  const isCompleted = useMemo(() => {
    if (!activeRoute) return false
    return (
      !isActive &&
      (state?.visitedStops?.length ?? 0) > 0 &&
      currentStopIndex >= activeRoute.stops.length
    )
  }, [activeRoute, isActive, state?.visitedStops, currentStopIndex])

  const availableThemes = useMemo(
    () => getAvailableThemes(venues, ''),
    [venues]
  )

  return {
    generateRoute,
    activeRoute,
    currentStopIndex,
    advanceToNext,
    isActive,
    isCompleted,
    startWalkthrough,
    endWalkthrough,
    estimatedCompletion,
    availableThemes,
  }
}
