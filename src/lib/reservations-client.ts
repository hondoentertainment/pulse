/**
 * Typed client wrappers for the reservations Edge Functions.
 */

import { supabase } from '@/lib/supabase'

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; details?: unknown }

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body ?? {}),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        error: (json as { error?: string }).error ?? `HTTP ${res.status}`,
        status: res.status,
        details: (json as { details?: unknown }).details,
      }
    }
    return { ok: true, data: (json as { data: T }).data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' }
  }
}

export interface ReservationRequestResult {
  reservation_id: string
  status: string
  client_secret?: string
  payment_intent_id?: string
  deposit_cents: number
}

export function requestReservation(args: {
  venue_id: string
  party_size: number
  starts_at: string
  ends_at?: string
  notes?: string
  deposit_cents?: number
}): Promise<ApiResult<ReservationRequestResult>> {
  return post<ReservationRequestResult>('/api/reservations/request', args)
}

export function updateReservation(args: {
  reservation_id: string
  status: 'confirmed' | 'seated' | 'cancelled' | 'no_show' | 'completed'
  note?: string
}): Promise<ApiResult<{ reservation_id: string; status: string }>> {
  return post('/api/reservations/update', args)
}
