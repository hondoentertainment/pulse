import { describe, it, expect, vi } from 'vitest'
import {
  purchaseTicket,
  purchaseAndRedirect,
  listTickets,
} from '@/lib/ticketing-client'

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('ticketing-client.purchaseTicket', () => {
  it('POSTs to /api/ticketing/purchase with the eventId + quantity', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, {
        data: {
          checkoutUrl: 'https://checkout.stripe.com/abc',
          sessionId: 'cs_1',
          ticketId: 'tkt_1',
          ticketIds: ['tkt_1'],
        },
      }),
    )
    const result = await purchaseTicket(
      { eventId: 'evt_1', quantity: 2 },
      { fetchImpl, authToken: 'abc' },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.checkoutUrl).toMatch(/checkout\.stripe\.com/)
    }
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/ticketing/purchase')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toBe('Bearer abc')
    expect(JSON.parse(String(init.body))).toEqual({ eventId: 'evt_1', quantity: 2 })
  })

  it('surfaces typed errors on non-2xx', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(403, { error: 'event_not_purchasable' }),
    )
    const result = await purchaseTicket(
      { eventId: 'evt_1', quantity: 1 },
      { fetchImpl, authToken: null },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('event_not_purchasable')
      expect(result.status).toBe(403)
    }
  })

  it('returns a network error on fetch rejection', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    })
    const result = await purchaseTicket(
      { eventId: 'evt_1', quantity: 1 },
      { fetchImpl, authToken: null },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('offline')
  })

  it('includes successUrl / cancelUrl when provided', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, {
        data: { checkoutUrl: 'x', sessionId: 's', ticketId: 't', ticketIds: ['t'] },
      }),
    )
    await purchaseTicket(
      {
        eventId: 'evt',
        quantity: 1,
        successUrl: 'https://app.example/x',
        cancelUrl: 'https://app.example/y',
      },
      { fetchImpl, authToken: null },
    )
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.successUrl).toBe('https://app.example/x')
    expect(body.cancelUrl).toBe('https://app.example/y')
  })
})

describe('ticketing-client.purchaseAndRedirect', () => {
  it('calls the redirect helper with the checkout url on success', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, {
        data: {
          checkoutUrl: 'https://checkout.stripe.com/cs_happy',
          sessionId: 'cs_happy',
          ticketId: 'tkt',
          ticketIds: ['tkt'],
        },
      }),
    )
    const redirect = vi.fn()
    const result = await purchaseAndRedirect(
      { eventId: 'evt_1', quantity: 1 },
      { fetchImpl, authToken: null, redirect },
    )
    expect(result.ok).toBe(true)
    expect(redirect).toHaveBeenCalledWith('https://checkout.stripe.com/cs_happy')
  })

  it('does NOT redirect on server error', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(500, { error: 'boom' }))
    const redirect = vi.fn()
    const result = await purchaseAndRedirect(
      { eventId: 'evt_1', quantity: 1 },
      { fetchImpl, authToken: null, redirect },
    )
    expect(result.ok).toBe(false)
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('ticketing-client.listTickets', () => {
  it('GETs /api/ticketing/mine and returns the data array', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, {
        data: [
          {
            id: 'tkt_1',
            event_id: 'evt',
            user_id: 'u',
            ticket_type: 'general_admission',
            price_cents: 2500,
            currency: 'usd',
            status: 'paid',
            stripe_payment_intent: 'pi_1',
            qr_code_secret: 'deadbeef',
            created_at: '2026-04-19T00:00:00Z',
            paid_at: '2026-04-19T00:01:00Z',
            refunded_at: null,
            transferred_at: null,
          },
        ],
      }),
    )
    const result = await listTickets({ fetchImpl, authToken: 'tok' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('paid')
    }
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/ticketing/mine')
    expect(init.method).toBe('GET')
  })

  it('surfaces auth failures (401)', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(401, { error: 'Unauthorized' }),
    )
    const result = await listTickets({ fetchImpl, authToken: null })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })
})
