import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import type { RequestLike, ResponseLike } from '../../_lib/http'

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}))

vi.mock('../../_lib/supabase-server', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/supabase-server')>(
    '../../_lib/supabase-server',
  )
  return {
    ...actual,
    createAdminClient: () => createAdminClientMock(),
  }
})

import handler from '../stripe'

const WEBHOOK_SECRET = 'whsec_test'

function signPayload(raw: string, secret: string, timestamp?: number): { header: string; timestamp: number } {
  const t = timestamp ?? Math.floor(Date.now() / 1000)
  const signed = `${t}.${raw}`
  const v1 = createHmac('sha256', secret).update(signed).digest('hex')
  return { header: `t=${t},v1=${v1}`, timestamp: t }
}

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

function makeRequest(body: string, signature?: string): RequestLike {
  const headers: Record<string, string> = {}
  if (signature !== undefined) headers['stripe-signature'] = signature
  return { method: 'POST', body, headers }
}

beforeEach(() => {
  createAdminClientMock.mockReset()
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.SUPABASE_URL = 'https://supa.test'
})

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET
})

describe('POST /api/webhooks/stripe', () => {
  it('returns 401 on missing / bad signature', async () => {
    createAdminClientMock.mockReturnValue({
      from: () => ({
        insert: async () => ({ error: null }),
      }),
    })
    const rawBody = JSON.stringify({ id: 'evt_1', type: 'ping', data: { object: {} }, created: 0 })
    const { res, state } = makeResponse()
    await handler(makeRequest(rawBody, 't=1,v1=deadbeef'), res)
    expect(state.status).toBe(401)
  })

  it('returns 400 on unparseable body', async () => {
    const raw = '{not json'
    const { header } = signPayload(raw, WEBHOOK_SECRET)
    const { res, state } = makeResponse()
    await handler(makeRequest(raw, header), res)
    expect(state.status).toBe(400)
  })

  it('flips matching pending tickets to paid on checkout.session.completed', async () => {
    const ticketUpdateArgs: unknown[] = []
    const ticketUpdateChain = {
      in: (_col: string, _list: string[]) => ({
        eq: async (_c: string, _v: string) => {
          ticketUpdateArgs.push({ in: _list, eq: _v })
          return { error: null }
        },
      }),
    }
    const insertCalls: unknown[] = []
    createAdminClientMock.mockReturnValue({
      from(table: string) {
        if (table === 'stripe_webhook_events') {
          return {
            insert: async (row: unknown) => {
              insertCalls.push(row)
              return { error: null }
            },
          }
        }
        if (table === 'tickets') {
          return {
            update: (_u: unknown) => ticketUpdateChain,
          }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    })

    const payload = {
      id: 'evt_happy',
      type: 'checkout.session.completed',
      created: 123,
      data: {
        object: {
          id: 'cs_1',
          payment_intent: 'pi_1',
          payment_status: 'paid',
          status: 'complete',
        },
      },
    }
    const raw = JSON.stringify(payload)
    const { header } = signPayload(raw, WEBHOOK_SECRET)
    const { res, state } = makeResponse()
    await handler(makeRequest(raw, header), res)

    expect(state.status).toBe(200)
    expect(state.body).toEqual({ data: { received: true, event_id: 'evt_happy', type: 'checkout.session.completed' } })
    expect(ticketUpdateArgs).toHaveLength(1)
    const { in: inList, eq } = ticketUpdateArgs[0] as { in: string[]; eq: string }
    expect(inList).toContain('cs_1')
    expect(inList).toContain('pi_1')
    expect(eq).toBe('pending')
    expect(insertCalls).toHaveLength(1)
  })

  it('is idempotent on duplicate delivery (23505 unique violation)', async () => {
    createAdminClientMock.mockReturnValue({
      from(table: string) {
        if (table === 'stripe_webhook_events') {
          return {
            insert: async () => ({
              error: { message: 'duplicate', code: '23505' },
            }),
          }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    })

    const payload = {
      id: 'evt_dupe',
      type: 'checkout.session.completed',
      created: 1,
      data: { object: { id: 'cs_x', payment_status: 'paid' } },
    }
    const raw = JSON.stringify(payload)
    const { header } = signPayload(raw, WEBHOOK_SECRET)
    const { res, state } = makeResponse()
    await handler(makeRequest(raw, header), res)

    expect(state.status).toBe(200)
    expect(state.body).toEqual({ data: { duplicate: true, event_id: 'evt_dupe' } })
  })

  it('skips status update when session.payment_status !== "paid"', async () => {
    const updateSpy = vi.fn()
    createAdminClientMock.mockReturnValue({
      from(table: string) {
        if (table === 'stripe_webhook_events') {
          return { insert: async () => ({ error: null }) }
        }
        if (table === 'tickets') {
          return {
            update: (...args: unknown[]) => {
              updateSpy(...args)
              return {
                in: () => ({ eq: async () => ({ error: null }) }),
              }
            },
          }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    })
    const payload = {
      id: 'evt_unpaid',
      type: 'checkout.session.completed',
      created: 1,
      data: { object: { id: 'cs_y', payment_status: 'unpaid' } },
    }
    const raw = JSON.stringify(payload)
    const { header } = signPayload(raw, WEBHOOK_SECRET)
    const { res, state } = makeResponse()
    await handler(makeRequest(raw, header), res)

    expect(state.status).toBe(200)
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
