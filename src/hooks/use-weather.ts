import { useCallback, useEffect, useRef, useState } from 'react'
import type { WeatherPayload } from '../lib/types'

interface UseWeatherOptions {
  lat?: number | null
  lng?: number | null
  /** Override the base fetch URL (defaults to "/api/weather/current"). */
  endpoint?: string
  /** Disable auto-fetch. */
  enabled?: boolean
}

interface UseWeatherState {
  weather: WeatherPayload | null
  error: string | null
  loading: boolean
  refresh: () => void
}

// Coordinate rounding + 15-minute bucket. Matches server cache key so the
// client avoids firing redundant requests.
const CACHE_MS = 15 * 60 * 1000

type CacheEntry = { payload: WeatherPayload; storedAt: number }
const clientCache = new Map<string, CacheEntry>()

const bucketKey = (lat: number, lng: number): string => {
  const rLat = Math.round(lat * 100) / 100
  const rLng = Math.round(lng * 100) / 100
  const bucket = Math.floor(Date.now() / CACHE_MS)
  return `${rLat},${rLng},${bucket}`
}

const isFlagOn = (): boolean => {
  try {
    const raw = (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env?.VITE_WEATHER_BOOST_ENABLED
    if (typeof raw !== 'string') return true
    const n = raw.trim().toLowerCase()
    return !['0', 'false', 'no', 'off'].includes(n)
  } catch {
    return true
  }
}

/**
 * React hook that fetches current weather for a lat/lng.
 * Caches results in-memory per 15-minute bucket.  Returns the latest payload
 * and a `refresh()` to invalidate the cache entry.
 */
export function useWeather({ lat, lng, endpoint = '/api/weather/current', enabled = true }: UseWeatherOptions): UseWeatherState {
  const [weather, setWeather] = useState<WeatherPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchWeather = useCallback(
    async (latV: number, lngV: number) => {
      const key = bucketKey(latV, lngV)
      const hit = clientCache.get(key)
      if (hit && Date.now() - hit.storedAt < CACHE_MS) {
        setWeather(hit.payload)
        setError(null)
        return
      }

      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      try {
        const res = await fetch(
          `${endpoint}?lat=${encodeURIComponent(latV)}&lng=${encodeURIComponent(lngV)}`,
          { signal: ac.signal },
        )
        if (!res.ok) {
          throw new Error(`weather request failed: ${res.status}`)
        }
        const body = (await res.json()) as { data?: WeatherPayload }
        if (body.data) {
          clientCache.set(key, { payload: body.data, storedAt: Date.now() })
          setWeather(body.data)
          setError(null)
        } else {
          setError('weather_missing_data')
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'weather_failed')
        }
      } finally {
        setLoading(false)
      }
    },
    [endpoint],
  )

  useEffect(() => {
    if (!enabled) return
    if (!isFlagOn()) return
    if (typeof lat !== 'number' || typeof lng !== 'number') return
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    void fetchWeather(lat, lng)
    return () => {
      abortRef.current?.abort()
    }
  }, [lat, lng, enabled, fetchWeather])

  const refresh = useCallback(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return
    const key = bucketKey(lat, lng)
    clientCache.delete(key)
    void fetchWeather(lat, lng)
  }, [lat, lng, fetchWeather])

  return { weather, error, loading, refresh }
}
