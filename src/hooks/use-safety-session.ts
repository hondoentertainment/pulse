import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  endSafetySession,
  pingSafetySession,
  startSafetySession,
  triggerSafetyPanic,
  type SafetyContactSnapshot,
  type SafetySession,
  type SafetySessionKind,
  type SafetySessionState,
} from '@/lib/safety-client'

export type SafetyPermissionState = 'idle' | 'prompted' | 'granted' | 'denied' | 'unavailable'

export interface SafetySessionControllerOptions {
  /** Milliseconds between ping attempts. Default 30s. Kept at 30s to conserve battery. */
  pingIntervalMs?: number
  /** Called on any state transition, useful for analytics. */
  onStateChange?: (next: SafetySessionState | null) => void
}

export interface UseSafetySessionResult {
  session: SafetySession | null
  permission: SafetyPermissionState
  error: string | null
  isStarting: boolean
  isEnding: boolean
  lastLocation: { lat: number; lng: number } | null
  secondsRemaining: number | null
  start: (input: StartArgs) => Promise<{ ok: boolean; error?: string }>
  end: (reason?: 'user_completed' | 'cancelled') => Promise<{ ok: boolean; error?: string }>
  extend: (additionalMinutes: number) => void
  panic: (message?: string) => Promise<{ ok: boolean; error?: string }>
}

export interface StartArgs {
  kind: SafetySessionKind
  expectedDurationMinutes: number
  destination?: { venueId?: string; lat?: number; lng?: number; label?: string }
  contacts: SafetyContactSnapshot[]
  notes?: string
}

interface GeoPosition {
  coords: { latitude: number; longitude: number; accuracy?: number }
  timestamp: number
}

type GeoErrorCode = 1 | 2 | 3

interface GeoError {
  code: GeoErrorCode
  message: string
}

function getGeolocation():
  | {
      watchPosition: (
        success: (pos: GeoPosition) => void,
        error: (err: GeoError) => void,
        options?: PositionOptions,
      ) => number
      clearWatch: (id: number) => void
    }
  | null {
  const nav = (globalThis as { navigator?: { geolocation?: Geolocation } }).navigator
  return (nav?.geolocation as unknown as ReturnType<typeof getGeolocation>) ?? null
}

function readBatteryPct(): number | undefined {
  const nav = (globalThis as { navigator?: { getBattery?: () => Promise<{ level: number }> } }).navigator
  // We only read the battery synchronously when available via the legacy sync getter;
  // the async API is sampled lazily inside the ping loop via `navigator.getBattery()`.
  if (nav?.getBattery) return undefined
  return undefined
}

async function sampleBatteryPct(): Promise<number | undefined> {
  const nav = (globalThis as { navigator?: { getBattery?: () => Promise<{ level: number }> } }).navigator
  if (!nav?.getBattery) return undefined
  try {
    const battery = await nav.getBattery()
    return Math.round((battery.level ?? 1) * 100)
  } catch {
    return undefined
  }
}

function readNetworkQuality(): string | undefined {
  const nav = (globalThis as {
    navigator?: { connection?: { effectiveType?: string } }
  }).navigator
  return nav?.connection?.effectiveType
}

function computeSecondsRemaining(session: SafetySession | null, now: number): number | null {
  if (!session?.expected_end_at) return null
  const endMs = new Date(session.expected_end_at).getTime()
  if (Number.isNaN(endMs)) return null
  return Math.max(0, Math.round((endMs - now) / 1000))
}

export function useSafetySession(options: SafetySessionControllerOptions = {}): UseSafetySessionResult {
  const pingIntervalMs = options.pingIntervalMs ?? 30_000
  const onStateChange = options.onStateChange

  const [session, setSession] = useState<SafetySession | null>(null)
  const [permission, setPermission] = useState<SafetyPermissionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())

  const watchIdRef = useRef<number | null>(null)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const batteryHintRef = useRef<number | undefined>(readBatteryPct())

  // Track the latest session/location in refs for use inside timers.
  const sessionRef = useRef<SafetySession | null>(null)
  const locationRef = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  useEffect(() => {
    locationRef.current = lastLocation
  }, [lastLocation])

  const cleanup = useCallback(() => {
    const geo = getGeolocation()
    if (geo && watchIdRef.current != null) {
      geo.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = null
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current)
      pingTimerRef.current = null
    }
  }, [])

  // Tick `now` every second so `secondsRemaining` updates smoothly.
  useEffect(() => {
    if (!session || (session.state !== 'active' && session.state !== 'armed')) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [session])

  useEffect(() => () => cleanup(), [cleanup])

  const startLocationWatch = useCallback(() => {
    const geo = getGeolocation()
    if (!geo) {
      setPermission('unavailable')
      setError('geolocation-unavailable')
      return
    }
    setPermission('prompted')
    const id = geo.watchPosition(
      pos => {
        setPermission('granted')
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLastLocation(next)
      },
      errorObj => {
        if (errorObj.code === 1) {
          setPermission('denied')
          setError('permission-denied')
          // No silent retries: we explicitly stop the watch.
          if (watchIdRef.current != null) {
            geo.clearWatch(watchIdRef.current)
            watchIdRef.current = null
          }
        } else {
          setError(errorObj.message ?? 'geolocation-error')
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    )
    watchIdRef.current = id
  }, [])

  const startPingTimer = useCallback(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current)
    pingTimerRef.current = setInterval(async () => {
      const currentSession = sessionRef.current
      const currentLoc = locationRef.current
      if (!currentSession || !currentLoc) return
      if (currentSession.state !== 'active' && currentSession.state !== 'armed') return
      const batteryPct = (await sampleBatteryPct()) ?? batteryHintRef.current
      await pingSafetySession({
        sessionId: currentSession.id,
        lat: currentLoc.lat,
        lng: currentLoc.lng,
        batteryPct,
        networkQuality: readNetworkQuality(),
      })
    }, pingIntervalMs)
  }, [pingIntervalMs])

  const start = useCallback(
    async (input: StartArgs) => {
      setIsStarting(true)
      setError(null)
      const result = await startSafetySession({
        kind: input.kind,
        expectedDurationMinutes: input.expectedDurationMinutes,
        destination: input.destination,
        contacts: input.contacts,
        notes: input.notes,
      })
      setIsStarting(false)
      if (!result.ok) {
        setError(result.error)
        return { ok: false, error: result.error }
      }
      setSession(result.data)
      onStateChange?.(result.data.state)
      startLocationWatch()
      startPingTimer()
      return { ok: true }
    },
    [onStateChange, startLocationWatch, startPingTimer],
  )

  const end = useCallback(
    async (reason?: 'user_completed' | 'cancelled') => {
      const current = sessionRef.current
      if (!current) return { ok: true }
      setIsEnding(true)
      const result = await endSafetySession({ sessionId: current.id, reason })
      setIsEnding(false)
      if (!result.ok) {
        setError(result.error)
        return { ok: false, error: result.error }
      }
      setSession(result.data)
      onStateChange?.(result.data.state)
      cleanup()
      return { ok: true }
    },
    [cleanup, onStateChange],
  )

  const extend = useCallback((additionalMinutes: number) => {
    const current = sessionRef.current
    if (!current?.expected_end_at) return
    const nextEndMs = new Date(current.expected_end_at).getTime() + additionalMinutes * 60_000
    setSession({
      ...current,
      expected_end_at: new Date(nextEndMs).toISOString(),
    })
  }, [])

  const panic = useCallback(
    async (message?: string) => {
      const current = sessionRef.current
      const loc = locationRef.current
      const result = await triggerSafetyPanic({
        sessionId: current?.id,
        kind: current?.kind ?? 'panic',
        location: loc ? { lat: loc.lat, lng: loc.lng } : undefined,
        message,
      })
      if (!result.ok) {
        setError(result.error)
        return { ok: false, error: result.error }
      }
      setSession(prev =>
        prev
          ? { ...prev, state: 'alerted' as SafetySessionState }
          : ({
              id: result.data.sessionId,
              user_id: '',
              kind: 'panic',
              state: 'alerted',
              starts_at: new Date().toISOString(),
              expected_end_at: null,
              actual_end_at: null,
              last_ping_at: null,
              last_location_lat: loc?.lat ?? null,
              last_location_lng: loc?.lng ?? null,
              destination_venue_id: null,
              destination_lat: null,
              destination_lng: null,
              destination_label: null,
              contacts_snapshot: [],
              contacts_notified: [],
              notes: null,
            } satisfies SafetySession),
      )
      onStateChange?.('alerted')
      return { ok: true }
    },
    [onStateChange],
  )

  const secondsRemaining = useMemo(() => computeSecondsRemaining(session, now), [session, now])

  return {
    session,
    permission,
    error,
    isStarting,
    isEnding,
    lastLocation,
    secondsRemaining,
    start,
    end,
    extend,
    panic,
  }
}
