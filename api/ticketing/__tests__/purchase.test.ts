import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { RequestLike, ResponseLike } from '../../_lib/http'

// ─── Mocks for supabase + stripe helpers ───
//
// We mock the module factories directly so the handler uses in-memory fakes
// instead of real HTTP traffic. The handler depends on:
//   - verifySupabaseJwt (auth/_lib) — uses global fetch to hit Supabase
//   - createAdminClient (supabase-server) — wraps @supabase/supabase-js
//   - createCheckoutSession (stripe) — posts to api.stripe.com
//
// We replace the last two via vi.mock; the first we exercise by intercepting
// global.fetch with a Supabase-user-endpoint response.

const { createCheckoutSessionMock, createAdminClientMock } = vi.hoisted(() => ({
  createCheckoutSessionMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('../../_lib/stripe', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/stripe')>('../../_lib/stripe')
  return {
    ...actual,
    createCheckoutSession: createCheckoutSessionMock,
  }
})

vi.mock('../../_lib/supabase-server', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/supabase-server')>('../../_lib/supabase-server')
  return {
    ...actual,
    createAdminClient: () => createAdminClientMock(),
  }
})

import handler from '../purchase'

// ─── Test helpers ───

function makeResponse() {
  const state: { status: number; body: unknown; headers: Record<string, string> } = {
    status: 0,
    body: undefined,
    headers: {},
  }
  const res: ResponseLike = {
    status(code: number) {
      state.status = code
      return res
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value
    },
    json(payload: unknown) {
      state.body = payload
    },
    end() {
      /* no-op */
    },
  }
  return { res, state }
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): RequestLike {
  return {
    method: 'POST',
    body,
    headers: {
      authorization: 'Bearer test.jwt.token',
      origin: 'https://app.test',
      ...headers,
    },
  }
}

function mockSupabaseChain(results: {
  event?: { data: unknown; error?: { message: string } | null }
  payout?: { data: unknown; error?: { message: string } | null }
  ticketInsert?: { data: unknown; error?: { message: string } | null }
  ticketUpdate?: { error?: { message: string } | null }
  ticketDelete?: { error?: { message: string } | null }
}) {
  return {
    from(table: string) {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => results.event ?? { data: null },
            }),
          }),
        }
      }
      if (table === 'venue_payout_accounts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => results.payout ?? { data: null },
            }),
          }),
        }
      }
      if (table === 'tickets') {
        return {
          insert: () => ({
            select: async () => results.ticketInsert ?? { data: [], error: null },
          }),
          update: () => ({
            in: async () => results.ticketUpdate ?? { error: null },
          }),
          delete: () => ({
            in: async () => results.ticketDelete ?? { error: null },
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }
}

function mockAuthFetch(userId = 'user_test') {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: userId, email: 'test@example.com' }),
      } as unknown as Response
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

const EVENT_ID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  createCheckoutSessionMock.mockReset()
  createAdminClientMock.mockReset()
  process.env.SUPABASE_URL = 'https://supa.test'
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

afterEach(() => {
  delete (globalThis as { fetch?: unknown }).fetch
})

describe('POST /api/ticketing/purchase', () => {
  it('returns 401 when Authorization header is missing', async () => {
    mockAuthFetch()
    const req: RequestLike = { method: 'POST', body: {}, headers: {} }
    const { res, state } = makeResponse()
    await handler(req, res)
    expect(state.status).toBe(401)
  })

  it('returns 405 on non-POST', async () => {
    mockAuthFetch()
    const req: RequestLike = { method: 'GET', body: {}, headers: { authorization: 'Bearer x' } }
    const { res, state } = makeResponse()
    await handler(req, res)
    expect(state.status).toBe(405)
  })

  it('returns 400 for missing eventId / bad quantity', async () => {
    mockAuthFetch()
    const req = makeRequest({ eventId: 'not-a-uuid', quantity: 0 })
    const { res, state } = makeResponse()
    await handler(req, res)
    expect(state.status).toBe(400)
    expect((state.body as { error?: string }).error).toBe('validation_failed')
  })

  it('returns 404 when the event does not exist', async () => {
    mockAuthFetch()
    createAdminClientMock.mockReturnValue(
      mockSupabaseChain({ event: { data: null } }),
    )
    const { res, state } = makeResponse()
    await handler(makeRequest({ eventId: EVENT_ID, quantity: 1 }), res)
    expect(state.status).toBe(404)
  })

  it('returns 403 when the event is not published', async () => {
    mockAuthFetch()
    createAdminClientMock.mockReturnValue(
      mockSupabaseChain({
        event: {
          data: { id: EVENT_ID, venue_id: 'v1', status: 'draft' },
        },
      }),
    )
    const { res, state } = makeResponse()
    await handler(makeRequest({ eventId: EVENT_ID, quantity: 1 }), res)
    expect(state.status).toBe(403)
  })

  it('creates a checkout session, inserts pending tickets, and returns checkoutUrl', async () => {
    mockAuthFetch('user_happy')
    createAdminClientMock.mockReturnValue(
      mockSupabaseChain({
        event: {
          data: {
            id: EVENT_ID,
            venue_id: 'venue_1',
            title: 'Disco Night',
            status: 'published',
            currency: 'usd',
            cover_price_cents: 0,
            ticket_types: [
              { name: 'general_admission', price_cents: 2500, remaining: 100 },
            ],
          },
        },
        payout: {
          data: { stripe_account_id: 'acct_123', payouts_enabled: true },
        },
        ticketInsert: {
          data: [{ id: 'tkt_1' }, { id: 'tkt_2' }],
          error: null,
        },
      }),
    )
    createCheckoutSessionMock.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/pay/cs_test_1',
    })

    const { res, state } = makeResponse()
    await handler(makeRequest({ eventId: EVENT_ID, quantity: 2 }), res)

    expect(state.status).toBe(200)
    const body = state.body as { data: { checkoutUrl: string; sessionId: string; ticketId: string } }
    expect(body.data.checkoutUrl).toContain('cs_test_1')
    expect(body.data.sessionId).toBe('cs_test_1')
    expect(body.data.ticketId).toBe('tkt_1')

    expect(createCheckoutSessionMock).toHaveBeenCalledTimes(1)
    const args = createCheckoutSessionMock.mock.calls[0][0]
    expect(args.lineItems[0].amountCents).toBe(2500)
    expect(args.lineItems[0].quantity).toBe(2)
    expect(args.destinationAccountId).toBe('acct_123')
    expect(args.metadata.ticket_ids).toBe('tkt_1,tkt_2')
    expect(args.clientReferenceId).toBe('tkt_1')
    expect(args.successUrl).toContain('{CHECKOUT_SESSION_ID}')
  })

  it('rolls back pending tickets when Stripe throws', async () => {
    mockAuthFetch('user_rollback')
    const ticketDelete = vi.fn(async () => ({ error: null }))
    const chain = mockSupabaseChain({
      event: {
        data: {
          id: EVENT_ID,
          venue_id: 'venue_1',
          status: 'published',
          currency: 'usd',
          cover_price_cents: 0,
          ticket_types: [{ name: 'general_admission', price_cents: 2500, remaining: 10 }],
        },
      },
      ticketInsert: {
        data: [{ id: 'tkt_rb' }],
        error: null,
      },
    })
    // Override the tickets.delete chain to spy on the rollback call.
    const originalFrom = chain.from.bind(chain)
    chain.from = (table: string) => {
      const proxy = originalFrom(table)
      if (table === 'tickets') {
        return {
          ...proxy,
          delete: () => ({ in: ticketDelete }),
        }
      }
      return proxy
    }
    createAdminClientMock.mockReturnValue(chain)
    createCheckoutSessionMock.mockRejectedValue(new Error('stripe_exploded'))

    const { res, state } = makeResponse()
    await handler(makeRequest({ eventId: EVENT_ID, quantity: 1 }), res)

    expect(state.status).toBe(500)
    expect(ticketDelete).toHaveBeenCalled()
  })

  it('rejects free events to avoid creating $0 Checkout Sessions', async () => {
    mockAuthFetch()
    createAdminClientMock.mockReturnValue(
      mockSupabaseChain({
        event: {
          data: {
            id: EVENT_ID,
            venue_id: 'venue_1',
            status: 'published',
            currency: 'usd',
            cover_price_cents: 0,
            ticket_types: [],
          },
        },
      }),
    )
    const { res, state } = makeResponse()
    await handler(makeRequest({ eventId: EVENT_ID, quantity: 1 }), res)
    expect(state.status).toBe(400)
    expect((state.body as { error?: string }).error).toBe('event_is_free_no_checkout_needed')
  })
})
