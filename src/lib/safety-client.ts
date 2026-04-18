/**
 * Typed wrappers around the /api/safety/* Edge Functions.
 *
 * All functions return `{ ok: true, data }` or `{ ok: false, error }` and never
 * throw so callers in UI code can keep error handling flat. Authentication is
 * automatic: we read the current Supabase session and pass its access token as
 * `Authorization: Bearer <token>`.
 */

import { supabase } from './supabase'

export type SafetySessionKind = 'safe_walk' | 'share_night' | 'panic'
export type SafetySessionState = 'armed' | 'active' | 'completed' | 'alerted' | 'cancelled'

export interface SafetyContactSnapshot {
  id: string
  name: string
  phone_e164: string
  method: 'sms' | 'push'
}

export interface SafetySession {
  id: string
  user_id: string
  kind: SafetySessionKind
  state: SafetySessionState
  starts_at: string
  expected_end_at: string | null
  actual_end_at: string | null
  last_ping_at: string | null
  last_location_lat: number | null
  last_location_lng: number | null
  destination_venue_id: string | null
  destination_lat: number | null
  destination_lng: number | null
  destination_label: string | null
  contacts_snapshot: SafetyContactSnapshot[]
  contacts_notified: unknown[]
  notes: string | null
}

export type SafetyResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }

interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>
}

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function post<T>(path: string, body: unknown, deps?: { fetch?: FetchLike }): Promise<SafetyResult<T>> {
  const fetchFn: FetchLike = deps?.fetch ?? (globalThis.fetch as FetchLike)
  const headers = {
    'Content-Type': 'application/json',
    ...(await getAuthHeader()),
  }
  try {
    const response = await fetchFn(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const parsed = (await response.json().catch(() => ({}))) as { data?: T; error?: string }
    if (!response.ok) {
      return { ok: false, error: parsed.error ?? `http-${response.status}`, status: response.status }
    }
    return { ok: true, data: (parsed.data ?? (parsed as unknown as T)) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'network-error' }
  }
}

// ---- sessions -----------------------------------------------------------

export interface StartSessionInput {
  kind: SafetySessionKind
  expectedDurationMinutes?: number
  destination?: {
    venueId?: string
    lat?: number
    lng?: number
    label?: string
  }
  contacts: SafetyContactSnapshot[]
  notes?: string
}

export function startSafetySession(
  input: StartSessionInput,
  deps?: { fetch?: FetchLike },
): Promise<SafetyResult<SafetySession>> {
  return post<SafetySession>('/api/safety/session/start', input, deps)
}

export interface PingInput {
  sessionId: string
  lat: number
  lng: number
  batteryPct?: number
  networkQuality?: string
}

export function pingSafetySession(
  input: PingInput,
  deps?: { fetch?: FetchLike },
): Promise<SafetyResult<{ ok: boolean }>> {
  return post<{ ok: boolean }>('/api/safety/session/ping', input, deps)
}

export interface EndInput {
  sessionId: string
  reason?: 'user_completed' | 'cancelled'
}

export function endSafetySession(
  input: EndInput,
  deps?: { fetch?: FetchLike },
): Promise<SafetyResult<SafetySession>> {
  return post<SafetySession>('/api/safety/session/end', input, deps)
}

export interface TriggerInput {
  sessionId?: string
  kind?: SafetySessionKind
  location?: { lat: number; lng: number }
  message?: string
}

export interface TriggerResult {
  sessionId: string
  state: SafetySessionState
  notified: number
  results: Array<{ contactId: string; ok: boolean; provider: string }>
}

export function triggerSafetyPanic(
  input: TriggerInput,
  deps?: { fetch?: FetchLike },
): Promise<SafetyResult<TriggerResult>> {
  return post<TriggerResult>('/api/safety/session/trigger', input, deps)
}

// ---- contacts -----------------------------------------------------------

export interface VerifyInput {
  contactId: string
}

export function sendContactVerificationCode(
  input: VerifyInput,
  deps?: { fetch?: FetchLike },
): Promise<SafetyResult<{ ok: boolean; expiresAt?: string }>> {
  return post<{ ok: boolean; expiresAt?: string }>('/api/safety/contacts/verify', input, deps)
}

export interface ConfirmInput {
  contactId: string
  code: string
}

export function confirmContactVerificationCode(
  input: ConfirmInput,
  deps?: { fetch?: FetchLike },
): Promise<SafetyResult<{ ok: boolean; verifiedAt: string }>> {
  return post<{ ok: boolean; verifiedAt: string }>('/api/safety/contacts/confirm', input, deps)
}
