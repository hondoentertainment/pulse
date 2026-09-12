import { describe, expect, it, vi } from 'vitest'

const query = {
  order: () => query,
  limit: () => query,
  eq: () => query,
  then: (resolve: (value: { data: Array<{ id: string; status: string }>; error: null }) => void) => {
    resolve({ data: [{ id: 'c1', status: 'pending' }], error: null })
  },
}

vi.mock('../../_lib/supabase-server.js', () => ({
  createUserClient: () => ({
    from: () => ({
      select: () => query,
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'c1', status: 'verified' }, error: null }),
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('../../_lib/auth.js', () => ({
  requireAuth: () => ({
    ok: true,
    context: { userId: 'admin-1', token: 'tok' },
  }),
  decodeJwt: () => ({ app_metadata: { role: 'admin' } }),
}))

import handler from '../venue-claims.ts'

function mockRes() {
  return {
    statusCode: 200,
    body: null as unknown,
    setHeader: () => undefined,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
    end() {
      return this
    },
  }
}

describe('GET /api/admin/venue-claims', () => {
  it('lists pending claims for ops', async () => {
    const res = mockRes()
    await handler({ method: 'GET', headers: {}, query: { status: 'pending' } } as never, res as never)
    expect(res.statusCode).toBe(200)
  })
})

describe('PATCH /api/admin/venue-claims', () => {
  it('verifies a claim without table-editor guesswork', async () => {
    const res = mockRes()
    await handler({
      method: 'PATCH',
      headers: {},
      body: { claimId: 'c1', status: 'verified' },
    } as never, res as never)
    expect(res.statusCode).toBe(200)
  })
})
