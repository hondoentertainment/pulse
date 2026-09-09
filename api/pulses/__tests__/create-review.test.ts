import { describe, expect, it, vi } from 'vitest'

vi.mock('../../_lib/supabase-server.js', () => ({
  createUserClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              gte: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: 'pulse-1' }, error: null }),
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
  consume: () => ({ allowed: true, limit: 10, remaining: 9, retryAfterMs: 0 }),
}))

vi.mock('../../_lib/moderation.js', () => ({
  checkContent: () => ({ allowed: true, reasons: [], severity: 'low', sanitized: 'ok' }),
}))

import handler from '../create.ts'

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

describe('POST /api/pulses/create live reviews', () => {
  it('rejects a review without a caption', async () => {
    const res = mockRes()
    await handler(
      {
        method: 'POST',
        headers: {},
        body: { venueId: 'venue-1', energyRating: 'buzzing', kind: 'review' },
      } as never,
      res as never,
    )
    expect(res.statusCode).toBe(400)
  })

  it('accepts a review with required caption', async () => {
    const res = mockRes()
    await handler(
      {
        method: 'POST',
        headers: {},
        body: {
          venueId: 'venue-1',
          energyRating: 'electric',
          caption: 'Room is packed',
          kind: 'review',
          locationVerified: true,
        },
      } as never,
      res as never,
    )
    expect(res.statusCode).toBe(201)
  })
})
