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

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

interface BaseOptions {
  fetchImpl?: Fetcher
  authToken?: string | null
}

function getFetch(opts?: BaseOptions): Fetcher {
  if (opts?.fetchImpl) return opts.fetchImpl
  if (typeof fetch !== 'undefined') return fetch.bind(globalThis)
  throw new Error('No fetch implementation available')
}

async function authHeader(opts?: BaseOptions): Promise<Record<string, string>> {
  if (opts?.authToken !== undefined) {
    return opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}
  }
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = (await res.json()) as unknown
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}

async function post<T>(
  path: string,
  body: unknown,
  opts?: BaseOptions,
): Promise<ApiResult<T>> {
  try {
    const f = getFetch(opts)
    const res = await f(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeader(opts)),
      },
      body: JSON.stringify(body ?? {}),
    })
    const json = await parseJson(res)
    if (!res.ok) {
      return {
        ok: false,
        error: (json.error as string | undefined) ?? `HTTP ${res.status}`,
        status: res.status,
        details: json.details,
      }
    }
    const data = 'data' in json ? json.data : json
    return { ok: true, data: data as T }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'network_error',
    }
  }
}

async function get<T>(path: string, opts?: BaseOptions): Promise<ApiResult<T>> {
  try {
    const f = getFetch(opts)
    const res = await f(path, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeader(opts)),
      },
    })
    const json = await parseJson(res)
    if (!res.ok) {
      return {
        ok: false,
        error: (json.error as string | undefined) ?? `HTTP ${res.status}`,
        status: res.status,
        details: json.details,
      }
    }
    const data = 'data' in json ? json.data : json
    return { ok: true, data: data as T }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'network_error',
    }
  }
}

// ─── Purchase (Stripe Checkout Session) ───

export interface PurchaseTicketArgs {
  eventId: string
  quantity: number
  successUrl?: string
  cancelUrl?: string
  ticketType?: string
}

export interface PurchaseTicketResult {
  checkoutUrl: string
  sessionId: string
  ticketId: string
  ticketIds: string[]
}

export function purchaseTicket(
  args: PurchaseTicketArgs,
  opts?: BaseOptions,
): Promise<ApiResult<PurchaseTicketResult>> {
  return post<PurchaseTicketResult>('/api/ticketing/purchase', args, opts)
}

/**
 * Convenience: fires the purchase, then redirects the browser to the Stripe
 * Checkout url. Resolves with the api result; on success the redirect is
 * initiated and the promise typically doesn't matter because the tab
 * navigates away, but we still surface the outcome for testability.
 */
export async function purchaseAndRedirect(
  args: PurchaseTicketArgs,
  opts?: BaseOptions & { redirect?: (url: string) => void },
): Promise<ApiResult<PurchaseTicketResult>> {
  const result = await purchaseTicket(args, opts)
  if (result.ok && result.data.checkoutUrl) {
    const redirect = opts?.redirect ?? defaultRedirect
    redirect(result.data.checkoutUrl)
  }
  return result
}

function defaultRedirect(url: string): void {
  if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
    window.location.assign(url)
  }
}

// ─── List tickets ───

export interface TicketRow {
  id: string
  event_id: string
  user_id: string
  ticket_type: string
  price_cents: number
  currency: string
  status: 'pending' | 'paid' | 'refunded' | 'transferred' | 'cancelled'
  stripe_payment_intent: string | null
  qr_code_secret: string | null
  created_at: string
  paid_at: string | null
  refunded_at: string | null
  transferred_at: string | null
}

export function listTickets(opts?: BaseOptions): Promise<ApiResult<TicketRow[]>> {
  return get<TicketRow[]>('/api/ticketing/mine', opts)
}

// ─── Legacy helpers (unchanged) ───

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
