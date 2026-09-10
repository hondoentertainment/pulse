import { describe, expect, it, vi } from 'vitest'

const upsertSingle = vi.fn(async () => ({
  data: { id: 'claim-1', venue_id: 'venue-1', user_id: 'user-1', status: 'pending' },
  error: null,
}))

vi.mock('../../_lib/supabase-server.js', () => ({
  createUserClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: upsertSingle,
        }),
      }),
    }),
  }),
}))

vi.mock('../../_lib/auth.js', () => ({
  requireAuth: () => ({
    ok: true,
    context: { userId: 'user-1', token: 'tok' },
  }),
}))

vi.mock('../../_lib/rate-limit.js', () => ({
  consume: () => ({ allowed: true, limit: 5, remaining: 4, retryAfterMs: 0 }),
}))

import handler from '../claims.ts'

function mockRes() {
  const headers = new Map<string, string>()
  return {
    statusCode: 200,
    body: null as unknown,
    setHeader: (k: string, v: string) => headers.set(k, v),
    status: function (code: number) {
      this.statusCode = code
      return this
    },
    json: function (body: unknown) {
      this.body = body
      return this
    },
    end: function () {
      return this
    },
    headers,
  }
}

describe('POST /api/venues/claims', () => {
  it('rejects short evidence', async () => {
    const res = mockRes()
    await handler(
      {
        method: 'POST',
        headers: {},
        body: { venueId: 'venue-1', evidence: 'hi' },
      } as never,
      res as never,
    )
    expect(res.statusCode).toBe(400)
  })

  it('accepts a pending claim', async () => {
    const res = mockRes()
    await handler(
      {
        method: 'POST',
        headers: {},
        body: { venueId: 'venue-1', evidence: 'I am the general manager' },
      } as never,
      res as never,
    )
    expect(res.statusCode).toBe(201)
  })
})

describe('GET /api/venues/claims', () => {
  it('lists the caller claims', async () => {
    const res = mockRes()
    await handler({ method: 'GET', headers: {}, query: {} } as never, res as never)
    expect(res.statusCode).toBe(200)
  })
})
