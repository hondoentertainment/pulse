/**
 * Typed client wrappers for the ticketing Edge Functions.
 *
 * Returns a discriminated `ApiResult<T>` so callers never throw on network
 * errors; they can distinguish `ok=true` / `ok=false` at the type level.
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
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeader()),
      },
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
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'network_error',
    }
  }
}

export interface PurchaseResult {
  ticket_id: string
  client_secret?: string
  amount_cents: number
  currency: string
  payment_intent_id: string
}

export function purchaseTicket(args: {
  event_id: string
  ticket_type: string
}): Promise<ApiResult<PurchaseResult>> {
  return post<PurchaseResult>('/api/ticketing/purchase', args)
}

export interface ConfirmResult {
  ticket_id: string
  status: string
  qr_code_secret?: string
  already_confirmed?: boolean
  stripe_status?: string
}

export function confirmTicket(args: {
  ticket_id: string
  payment_intent_id: string
}): Promise<ApiResult<ConfirmResult>> {
  return post<ConfirmResult>('/api/ticketing/confirm', args)
}

export function refundTicket(args: {
  ticket_id: string
  force?: boolean
}): Promise<ApiResult<{ ticket_id: string; refund_id: string; status: string }>> {
  return post('/api/ticketing/refund', args)
}

export function initiateTransfer(args: {
  ticket_id: string
  recipient_user_id: string
}): Promise<ApiResult<{ ticket_id: string; transfer_token: string }>> {
  return post('/api/ticketing/transfer', { action: 'initiate', ...args })
}

export function acceptTransfer(args: {
  ticket_id: string
  transfer_token: string
}): Promise<ApiResult<{ ticket_id: string; status: string }>> {
  return post('/api/ticketing/transfer', { action: 'accept', ...args })
}

export function requestPayoutOnboarding(args: {
  venue_id: string
  refresh_url: string
  return_url: string
}): Promise<ApiResult<{ stripe_account_id: string; onboarding_url: string; expires_at: number }>> {
  return post('/api/venue-payouts/onboarding', args)
}
