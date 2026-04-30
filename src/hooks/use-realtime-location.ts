import { useState, useEffect, useRef } from 'react'
import { watchPosition as nativeWatch, isNative, requestLocationPermission } from '@/lib/native-bridge'

export interface LocationState {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
  speed: number | null
  timestamp: number
}

export interface UseRealtimeLocationOptions {
  enableHighAccuracy?: boolean
  maximumAge?: number
  timeout?: number
  distanceFilter?: number
}

export function useRealtimeLocation(options: UseRealtimeLocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    maximumAge = 0,
    timeout = 5000,
    distanceFilter = 0
  } = options

  const [location, setLocation] = useState<LocationState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const lastLocationRef = useRef<LocationState | null>(null)

  useEffect(() => {
    let cleanup: (() => void) | null = null
    let isMounted = true

    const startTracking = async () => {
      if (isNative) {
        const granted = await requestLocationPermission()
        if (!isMounted) return
        if (!granted) {
          setError('Location permission denied')
          return
        }
      } else if (!('geolocation' in navigator)) {
        setError('Geolocation is not supported')
        return
      }

      cleanup = nativeWatch((pos) => {
        if (!isMounted) return

        const newLocation: LocationState = {
          lat: pos.lat,
          lng: pos.lng,
          accuracy: 0,
          heading: null,
          speed: null,
          timestamp: Date.now()
        }

        if (distanceFilter > 0 && lastLocationRef.current) {
          const distance = calculateDistance(
            lastLocationRef.current.lat,
            lastLocationRef.current.lng,
            newLocation.lat,
            newLocation.lng
          )
          if (distance < distanceFilter) return
        }

        lastLocationRef.current = newLocation
        setLocation(newLocation)
        setError(null)
        setIsTracking(true)
      })
    }

    void startTracking()

    return () => {
      isMounted = false
      cleanup?.()
      setIsTracking(false)
    }
  }, [enableHighAccuracy, maximumAge, timeout, distanceFilter])

  return { location, error, isTracking }
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusMiles = 3958.8
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMiles * c
}
