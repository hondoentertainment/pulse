import { useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Venue, Notification } from '@/lib/types'
import { toast } from 'sonner'

interface VenueSurgeState {
  [venueId: string]: {
    lastScore: number
    lastAlertTime: number
    alertCount: number
  }
}

const SURGE_THRESHOLD = 60
const MIN_SCORE_INCREASE = 20
const ALERT_COOLDOWN_MS = 15 * 60 * 1000
const MAX_ALERTS_PER_VENUE = 3

export function useVenueSurgeTracker(
  venues: Venue[],
  userLocation: { lat: number; lng: number } | null,
  enabled: boolean
) {
  const [, setNotifications] = useKV<Notification[]>('notifications', [])
  const surgeStateRef = useRef<VenueSurgeState>({})

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
            alertCount: 0
          }
          return
        }

        const scoreIncrease = currentScore - state.lastScore
        const timeSinceLastAlert = now - state.lastAlertTime
        const isSurging = currentScore >= SURGE_THRESHOLD
        const hasSignificantIncrease = scoreIncrease >= MIN_SCORE_INCREASE
        const canAlert = 
          timeSinceLastAlert >= ALERT_COOLDOWN_MS &&
          state.alertCount < MAX_ALERTS_PER_VENUE

        if (isSurging && hasSignificantIncrease && canAlert) {
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            venue.location.lat,
            venue.location.lng
          )

          if (distance <= 5) {
            const notification: Notification = {
              id: `notif-surge-${venue.id}-${Date.now()}`,
              type: 'trending_venue',
              userId: 'system',
              venueId: venue.id,
              createdAt: new Date().toISOString(),
              read: false
            }

            setNotifications((current) => {
              if (!current) return [notification]
              return [notification, ...current]
            })

            toast.success('🔥 Venue Surging!', {
              description: `${venue.name} is popping off right now (${currentScore} energy)`,
              duration: 5000
            })

            surgeStateRef.current[venue.id] = {
              lastScore: currentScore,
              lastAlertTime: now,
              alertCount: state.alertCount + 1
            }
          }
        } else {
          surgeStateRef.current[venue.id] = {
            ...state,
            lastScore: currentScore
          }
        }
      })
    }

    checkForSurges()

    const interval = setInterval(checkForSurges, 30000)

    return () => clearInterval(interval)
  }, [venues, userLocation, enabled, setNotifications])
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
