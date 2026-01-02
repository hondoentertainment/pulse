import { useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { PulseCorrelation } from '@/lib/types'

export function useSocialBuzzVenues() {
  const [correlations] = useKV<PulseCorrelation[]>('pulseCorrelations', [])

  const socialBuzzVenues = useMemo(() => {
    if (!correlations || correlations.length === 0) return new Set<string>()

    const recentCorrelations = correlations
      .filter(c => {
        const age = Date.now() - new Date(c.calculatedAt).getTime()
        return age < 30 * 60 * 1000
      })
      .sort((a, b) => new Date(b.calculatedAt).getTime() - new Date(a.calculatedAt).getTime())

    const venueMap = new Map<string, PulseCorrelation>()
    for (const correlation of recentCorrelations) {
      if (!venueMap.has(correlation.venueId)) {
        venueMap.set(correlation.venueId, correlation)
      }
    }

    const buzzVenues = new Set<string>()
    for (const [venueId, correlation] of venueMap) {
      if (Math.abs(correlation.correlationCoefficient) >= 0.6 && correlation.socialPulseScore >= 40) {
        buzzVenues.add(venueId)
      }
    }

    return buzzVenues
  }, [correlations])

  const hasSocialBuzz = (venueId: string): boolean => {
    return socialBuzzVenues.has(venueId)
  }

  return { hasSocialBuzz, socialBuzzVenues }
}
