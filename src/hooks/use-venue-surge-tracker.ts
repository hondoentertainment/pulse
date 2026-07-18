import { useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Venue, Notification, Pulse } from '@/lib/types'
import { toast } from 'sonner'
import { notifyTrendingVenueViaApi } from '@/lib/api-client'
import { USE_SUPABASE_BACKEND } from '@/lib/data'
import { computeVenueSignal } from '@/lib/venue-signal'
import {
  milesBetween,
  shouldEmitSurgeAlert,
} from '@/lib/surge-alerts'

interface VenueSurgeState {
  [venueId: string]: {
    lastScore: number
    lastAlertTime: number
    alertCount: number
  }
}

export function useVenueSurgeTracker(
  venues: Venue[],
  userLocation: { lat: number; lng: number } | null,
  enabled: boolean,
  opts?: { accessToken?: string | null; pulses?: Pulse[] },
) {
  const [, setNotifications] = useKV<Notification[]>('notifications', [])
  const surgeStateRef = useRef<VenueSurgeState>({})
  const pulses = opts?.pulses ?? []

  useEffect(() => {
    if (!enabled || !userLocation || !venues) return

    const checkForSurges = () => {
      const now = Date.now()

      venues.forEach((venue) => {
        const currentScore = venue.pulseScore
        const state = surgeStateRef.current[venue.id]

        if (!state) {
          surgeStateRef.current[venue.id] = {
            lastScore: currentScore,
            lastAlertTime: 0,
            alertCount: 0,
          }
          return
        }

        const signal = computeVenueSignal(venue, pulses)
        const distance = milesBetween(
          userLocation.lat,
          userLocation.lng,
          venue.location.lat,
          venue.location.lng,
        )

        const shouldAlert = shouldEmitSurgeAlert({
          currentScore,
          lastScore: state.lastScore,
          lastAlertTime: state.lastAlertTime,
          alertCount: state.alertCount,
          now,
          confidence: signal.confidence,
          distanceMiles: distance,
        })

        if (shouldAlert) {
          const notification: Notification = {
            id: `notif-surge-${venue.id}-${Date.now()}`,
            type: 'trending_venue',
            userId: 'system',
            venueId: venue.id,
            createdAt: new Date().toISOString(),
            read: false,
          }

          setNotifications((current) => {
            if (!current) return [notification]
            return [notification, ...current]
          })

          toast.success('Venue surging nearby', {
            description: `${venue.name} just jumped to ${currentScore} energy (${signal.confidence} confidence)`,
            duration: 5000,
          })

          if (USE_SUPABASE_BACKEND && opts?.accessToken) {
            void notifyTrendingVenueViaApi(
              { venueId: venue.id, pulseScore: currentScore },
              { accessToken: opts.accessToken },
            )
          }

          surgeStateRef.current[venue.id] = {
            lastScore: currentScore,
            lastAlertTime: now,
            alertCount: state.alertCount + 1,
          }
        } else {
          surgeStateRef.current[venue.id] = {
            ...state,
            lastScore: currentScore,
          }
        }
      })
    }

    checkForSurges()

    const interval = setInterval(checkForSurges, 30000)

    return () => clearInterval(interval)
  }, [venues, userLocation, enabled, opts?.accessToken, pulses, setNotifications])
}
