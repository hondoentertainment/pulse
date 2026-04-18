/**
 * Thin typed HTTP client for the staff-side ticket verification and
 * purchase-cancel endpoints. Matches the app-wide `ApiResult<T>` shape.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

export interface VerifyTicketResponse {
  status: 'ok' | 'already_scanned' | 'invalid'
  ticketId?: string
  attendeeInitials?: string
  ticketType?: string
  scannedAt?: string
}

export interface CancelPurchaseResponse {
  status: 'cancelled' | 'already_cancelled'
  ticketId: string
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

interface ClientOptions {
  baseUrl?: string
  fetchImpl?: Fetcher
  authToken?: string | null
}

function getFetch(opts?: ClientOptions): Fetcher {
  if (opts?.fetchImpl) return opts.fetchImpl
  if (typeof fetch !== 'undefined') return fetch.bind(globalThis)
  throw new Error('No fetch implementation available')
}

function buildUrl(path: string, opts?: ClientOptions): string {
  const base = opts?.baseUrl ?? ''
  return `${base}${path}`
}

async function request<T>(path: string, body: unknown, opts?: ClientOptions): Promise<ApiResult<T>> {
  try {
    const f = getFetch(opts)
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }
    if (opts?.authToken) headers.authorization = `Bearer ${opts.authToken}`
    const res = await f(buildUrl(path, opts), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    let parsed: unknown = null
    try {
      parsed = await res.json()
    } catch {
      parsed = null
    }

    if (!res.ok) {
      const obj = (parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}) as Record<string, unknown>
      const message = typeof obj.error === 'string' ? obj.error : `HTTP ${res.status}`
      const code = typeof obj.code === 'string' ? obj.code : undefined
      return { ok: false, error: message, code }
    }

    const obj = (parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}) as Record<string, unknown>
    const data = ('data' in obj ? obj.data : obj) as T
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export function verifyTicket(qr: string, opts?: ClientOptions): Promise<ApiResult<VerifyTicketResponse>> {
  return request<VerifyTicketResponse>('/api/ticketing/verify', { ticketQr: qr }, opts)
}

export function cancelPurchase(ticketId: string, opts?: ClientOptions): Promise<ApiResult<CancelPurchaseResponse>> {
  return request<CancelPurchaseResponse>('/api/ticketing/cancel', { ticketId }, opts)
}
