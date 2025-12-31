import { useState, useEffect, useRef } from 'react'

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
  const watchIdRef = useRef<number | null>(null)
  const lastLocationRef = useRef<LocationState | null>(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported')
      return
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const newLocation: LocationState = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp
      }

      if (distanceFilter > 0 && lastLocationRef.current) {
        const distance = calculateDistance(
          lastLocationRef.current.lat,
          lastLocationRef.current.lng,
          newLocation.lat,
          newLocation.lng
        )
        
        if (distance < distanceFilter) {
          return
        }
      }

      lastLocationRef.current = newLocation
      setLocation(newLocation)
      setError(null)
      setIsTracking(true)
    }

    const handleError = (err: GeolocationPositionError) => {
      let errorMessage = 'Unknown location error'
      
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = 'Location permission denied'
          break
        case err.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable'
          break
        case err.TIMEOUT:
          errorMessage = 'Location request timed out'
          break
      }
      
      setError(errorMessage)
      setIsTracking(false)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        maximumAge,
        timeout
      }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
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
