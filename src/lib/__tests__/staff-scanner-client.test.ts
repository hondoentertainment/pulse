import { describe, it, expect, vi } from 'vitest'
import { verifyTicket, cancelPurchase } from '@/lib/staff-scanner-client'

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('staff-scanner-client.verifyTicket', () => {
  it('POSTs to /api/ticketing/verify with ticketQr', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, { data: { status: 'ok', ticketId: 't1', ticketType: 'vip' } })
    )
    const res = await verifyTicket('PULSE-TKT:t1:u1:aabb', { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/ticketing/verify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
      })
    )
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const init = call[1]
    expect(JSON.parse(String(init.body))).toEqual({ ticketQr: 'PULSE-TKT:t1:u1:aabb' })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.status).toBe('ok')
      expect(res.data.ticketId).toBe('t1')
    }
  })

  it('passes a Bearer token when authToken is provided', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(200, { data: { status: 'ok' } }))
    await verifyTicket('qr', { fetchImpl, authToken: 'tok_123' })
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const headers = call[1].headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer tok_123')
  })

  it('returns ok=false on non-2xx with an error message', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(403, { error: 'Signature mismatch', code: 'invalid_signature' })
    )
    const res = await verifyTicket('bad', { fetchImpl })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('Signature mismatch')
      expect(res.code).toBe('invalid_signature')
    }
  })

  it('handles network errors cleanly', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    })
    const res = await verifyTicket('qr', { fetchImpl })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('offline')
  })
})

describe('staff-scanner-client.cancelPurchase', () => {
  it('POSTs to /api/ticketing/cancel with ticketId', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, { data: { status: 'cancelled', ticketId: 't1' } })
    )
    const res = await cancelPurchase('t1', { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith('/api/ticketing/cancel', expect.any(Object))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.ticketId).toBe('t1')
  })

  it('returns the already_cancelled status', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, { data: { status: 'already_cancelled', ticketId: 't1' } })
    )
    const res = await cancelPurchase('t1', { fetchImpl })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.status).toBe('already_cancelled')
  })
})
