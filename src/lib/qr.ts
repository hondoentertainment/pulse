/**
 * QR helpers for ticket secrets.
 *
 * Payload format: "PULSE-TKT:<ticketId>:<userId>:<hmac>"
 *
 * HMAC is computed server-side with `TICKET_HMAC_SECRET`. This module
 * only generates/parses the envelope; verification lives in
 * `api/ticketing/verify.ts`.
 */

const PREFIX = 'PULSE-TKT'

export interface TicketQrPayload {
  ticketId: string
  userId: string
  hmac: string
}

export function encodeTicketQr(p: TicketQrPayload): string {
  return `${PREFIX}:${p.ticketId}:${p.userId}:${p.hmac}`
}

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

/**
 * Compute the HMAC-SHA256 of `ticketId:userId` using WebCrypto. Used on the
 * server when generating QR secrets; exported here so browser test harnesses
 * can exercise the same code path deterministically.
 */
export async function computeTicketHmac(
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
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/** Constant-time-ish string comparison for HMAC hex. */
export function hmacEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
