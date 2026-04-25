/**
 * use-push-registration — client hook
 *
 * On sign-in in a native Capacitor context:
 *   1. Request push permission (iOS prompts for provisional + alert/silent grants)
 *   2. Register the device with APNs / FCM to obtain a token
 *   3. POST the token to /api/push/register
 *
 * Web is a no-op. All `@capacitor/*` imports are dynamic via the Platform facade,
 * so the web bundle stays clean.
 */
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Platform, isNative } from '@/lib/platform'

interface UsePushRegistrationOptions {
  /** If falsy, the hook is a no-op. Typically the Supabase user id. */
  userId: string | null | undefined
  /** App version string to associate with the token (defaults to build-time env). */
  appVersion?: string
  /** If true, skips registration (e.g. tests). Default false. */
  disabled?: boolean
}

interface UsePushRegistrationResult {
  status: 'idle' | 'registering' | 'registered' | 'denied' | 'unavailable' | 'error'
  token: string | null
  error: string | null
}

const DEFAULT_APP_VERSION =
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION) ||
  '0.0.0'

export function usePushRegistration(opts: UsePushRegistrationOptions): UsePushRegistrationResult {
  const { userId, appVersion = DEFAULT_APP_VERSION, disabled } = opts
  const [status, setStatus] = useState<UsePushRegistrationResult['status']>('idle')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastRegisteredKey = useRef<string | null>(null)

  useEffect(() => {
    if (disabled) return
    if (!userId) return
    if (!isNative()) {
      setStatus('unavailable')
      return
    }

    // Avoid double registration for the same userId in the same session
    const key = `${userId}:${appVersion}`
    if (lastRegisteredKey.current === key) return

    let cancelled = false

    ;(async () => {
      setStatus('registering')
      setError(null)
      try {
        const result = await Platform.push.register()
        if (cancelled) return
        if (!result.granted || !result.token) {
          setStatus('denied')
          return
        }

        setToken(result.token)

        // Resolve the auth session for bearer header.
        let bearer: string | null = null
        try {
          const { data } = await supabase.auth.getSession()
          bearer = data.session?.access_token ?? null
        } catch {
          /* ok — fall back to body userId */
        }

        const deviceId = getDeviceId()
        const res = await fetch('/api/push/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
          body: JSON.stringify({
            token: result.token,
            platform: result.platform,
            deviceId,
            appVersion,
            // dev fallback
            userId,
          }),
        })

        if (cancelled) return
        if (!res.ok) {
          setStatus('error')
          setError(`Server ${res.status}`)
          return
        }

        lastRegisteredKey.current = key
        setStatus('registered')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, appVersion, disabled])

  return { status, token, error }
}

function getDeviceId(): string {
  try {
    const existing = typeof localStorage !== 'undefined' ? localStorage.getItem('pulse:device_id') : null
    if (existing) return existing
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev_${Math.random().toString(36).slice(2)}_${Date.now()}`
    if (typeof localStorage !== 'undefined') localStorage.setItem('pulse:device_id', id)
    return id
  } catch {
    return `dev_${Date.now()}`
  }
}
