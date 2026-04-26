import { describe, it, expect } from 'vitest'
import {
  parseTicketQr,
  computeHmac,
  verifyTicketHmac,
  decideScan,
  canScan,
} from '../ticket-verify'

describe('parseTicketQr', () => {
  it('parses a well-formed envelope', () => {
    const p = parseTicketQr('PULSE-TKT:ticket-1:user-1:deadbeef')
    expect(p).toEqual({ ticketId: 'ticket-1', userId: 'user-1', hmac: 'deadbeef' })
  })

  it('rejects the wrong prefix', () => {
    expect(parseTicketQr('OTHER:ticket-1:user-1:deadbeef')).toBeNull()
  })

  it('rejects missing parts', () => {
    expect(parseTicketQr('PULSE-TKT:ticket-1:user-1')).toBeNull()
    expect(parseTicketQr('PULSE-TKT::user-1:hmac')).toBeNull()
  })

  it('rejects non-string input', () => {
    // @ts-expect-error exercising runtime guard
    expect(parseTicketQr(42)).toBeNull()
    // @ts-expect-error exercising runtime guard
    expect(parseTicketQr(null)).toBeNull()
  })
})

describe('HMAC round-trip', () => {
  it('computes and verifies an HMAC with the same secret', async () => {
    const hmac = await computeHmac('ticket-1', 'user-1', 'topsecret')
    expect(hmac).toMatch(/^[0-9a-f]{64}$/)
    const ok = await verifyTicketHmac(
      { ticketId: 'ticket-1', userId: 'user-1', hmac },
      'topsecret'
    )
    expect(ok).toBe(true)
  })

  it('rejects when secret differs', async () => {
    const hmac = await computeHmac('ticket-1', 'user-1', 'topsecret')
    const ok = await verifyTicketHmac(
      { ticketId: 'ticket-1', userId: 'user-1', hmac },
      'different'
    )
    expect(ok).toBe(false)
  })

  it('rejects when ticketId is tampered', async () => {
    const hmac = await computeHmac('ticket-1', 'user-1', 'topsecret')
    const ok = await verifyTicketHmac(
      { ticketId: 'ticket-2', userId: 'user-1', hmac },
      'topsecret'
    )
    expect(ok).toBe(false)
  })
})

describe('decideScan', () => {
  it('returns ok for a paid ticket', () => {
    expect(decideScan({ ticketStatus: 'paid' }).kind).toBe('ok')
  })

  it('returns already_scanned inside the idempotent window', () => {
    const scannedAt = new Date().toISOString()
    const decision = decideScan({ ticketStatus: 'scanned', scannedAt })
    expect(decision.kind).toBe('already_scanned')
  })

  it('returns invalid/wrong_status outside the window', () => {
    const scannedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const decision = decideScan({ ticketStatus: 'scanned', scannedAt })
    expect(decision.kind).toBe('invalid')
  })

  it('returns invalid for cancelled', () => {
    expect(decideScan({ ticketStatus: 'cancelled' })).toEqual({
      kind: 'invalid',
      reason: 'cancelled',
    })
  })

  it('returns invalid for refunded', () => {
    expect(decideScan({ ticketStatus: 'refunded' })).toEqual({
      kind: 'invalid',
      reason: 'refunded',
    })
  })

  it('returns invalid for pending', () => {
    expect(decideScan({ ticketStatus: 'pending' }).kind).toBe('invalid')
  })
})

describe('canScan', () => {
  const ticketVenueId = 'v1'
  const base = {
    callerRole: null,
    callerUserId: 'u1',
    ticketVenueId,
    staffRows: [] as Array<{ venue_id: string; user_id: string; role: string }>,
  }

  it('allows when JWT claim role is venue_staff', () => {
    expect(canScan({ ...base, callerRole: 'venue_staff' })).toBe(true)
  })

  it('allows when staff row matches venue + user', () => {
    expect(
      canScan({ ...base, staffRows: [{ venue_id: 'v1', user_id: 'u1', role: 'door' }] })
    ).toBe(true)
  })

  it('denies when staff row is for a different venue', () => {
    expect(
      canScan({ ...base, staffRows: [{ venue_id: 'other', user_id: 'u1', role: 'door' }] })
    ).toBe(false)
  })

  it('denies when there is no caller', () => {
    expect(canScan({ ...base, callerUserId: null })).toBe(false)
  })
})
