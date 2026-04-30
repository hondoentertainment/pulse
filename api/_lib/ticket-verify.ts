/**
 * Pure helpers for ticket verification — extracted so they can be unit-tested
 * without any HTTP / Supabase setup. The request handler in
 * `api/ticketing/verify.ts` composes these.
 */

export interface TicketQrPayload {
  ticketId: string
  userId: string
  hmac: string
}

const PREFIX = 'PULSE-TKT'

export function parseTicketQr(raw: string): TicketQrPayload | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parts = trimmed.split(':')
  if (parts.length !== 4) return null
  const [prefix, ticketId, userId, hmac] = parts
  if (prefix !== PREFIX) return null
  if (!ticketId || !userId || !hmac) return null
  return { ticketId, userId, hmac }
}

export async function computeHmac(
  ticketId: string,
  userId: string,
  secret: string
): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${ticketId}:${userId}`))
  const bytes = new Uint8Array(sig)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex
}

export function hmacEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyTicketHmac(
  payload: TicketQrPayload,
  secret: string
): Promise<boolean> {
  const expected = await computeHmac(payload.ticketId, payload.userId, secret)
  return hmacEquals(expected, payload.hmac)
}

export type TicketStatus = 'pending' | 'paid' | 'cancelled' | 'refunded' | 'scanned'

export interface ScanDecisionInput {
  ticketStatus: TicketStatus
  scannedAt?: string | null
  /** The time-window (ms) during which a repeat scan is considered idempotent. */
  idempotentWindowMs?: number
  now?: number
}

export type ScanDecision =
  | { kind: 'ok' }
  | { kind: 'already_scanned'; scannedAt: string }
  | { kind: 'invalid'; reason: 'wrong_status' | 'cancelled' | 'refunded' }

export function decideScan(input: ScanDecisionInput): ScanDecision {
  const now = input.now ?? Date.now()
  const windowMs = input.idempotentWindowMs ?? 5 * 60 * 1000

  if (input.ticketStatus === 'cancelled') return { kind: 'invalid', reason: 'cancelled' }
  if (input.ticketStatus === 'refunded') return { kind: 'invalid', reason: 'refunded' }

  if (input.ticketStatus === 'scanned') {
    const scannedAt = input.scannedAt ?? new Date(0).toISOString()
    const delta = now - new Date(scannedAt).getTime()
    if (delta <= windowMs) return { kind: 'already_scanned', scannedAt }
    return { kind: 'invalid', reason: 'wrong_status' }
  }

  if (input.ticketStatus !== 'paid') return { kind: 'invalid', reason: 'wrong_status' }
  return { kind: 'ok' }
}

/**
 * Decide whether a caller has permission to scan a ticket at a venue.
 *
 * Role gating strategy (documented): we accept **either**
 *  - `app_metadata.role === 'venue_staff'` on the JWT, OR
 *  - a row in `venue_staff` matching `(venue_id, user_id)`.
 *
 * The JWT claim short-circuits for platform-wide staff; the table lookup
 * is the granular per-venue check. This lets us onboard existing staff
 * without backfilling the table and still enforce venue scoping.
 */
export interface RoleCheckInput {
  callerRole?: string | null
  callerUserId: string | null
  ticketVenueId: string
  staffRows: Array<{ venue_id: string; user_id: string; role: string }>
}

export function canScan(input: RoleCheckInput): boolean {
  if (input.callerRole === 'venue_staff') return true
  if (!input.callerUserId) return false
  return input.staffRows.some(
    r => r.venue_id === input.ticketVenueId && r.user_id === input.callerUserId
  )
}
