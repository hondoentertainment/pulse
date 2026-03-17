import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { Venue } from '@/lib/types'
import {
  generateEnergyHistory,
  type VenueEnergyHistory,
  type EnergyDataPoint,
} from '@/lib/venue-energy-history'

export type TimeRange = '24h' | '7d'

export interface UseVenueEnergyHistoryResult {
  history: VenueEnergyHistory | null
  isLoading: boolean
  selectedTimeRange: TimeRange
  setSelectedTimeRange: (range: TimeRange) => void
  hoveredPoint: EnergyDataPoint | null
  setHoveredPoint: (point: EnergyDataPoint | null) => void
}

/**
 * Hook that generates and manages a 24-hour energy history for a venue.
 * Refreshes the current-hour marker every minute.
 */
export function useVenueEnergyHistory(venue: Venue | null): UseVenueEnergyHistoryResult {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('24h')
  const [hoveredPoint, setHoveredPoint] = useState<EnergyDataPoint | null>(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Refresh current hour marker every 60 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentTime(new Date())
    }, 60_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Generate history, memoized by venueId + current hour
  const history = useMemo(() => {
    if (!venue) return null
    setIsLoading(false)
    return generateEnergyHistory(venue, currentTime)
    // Only re-generate when the venue id changes or the hour changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue?.id, currentTime.getHours()])

  // Mark loading false once we have data
  useEffect(() => {
    if (history) setIsLoading(false)
  }, [history])

  const stableSetHovered = useCallback((point: EnergyDataPoint | null) => {
    setHoveredPoint(point)
  }, [])

  return {
    history,
    isLoading,
    selectedTimeRange,
    setSelectedTimeRange,
    hoveredPoint,
    setHoveredPoint: stableSetHovered,
  }
}
