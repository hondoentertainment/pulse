import { describe, expect, it, vi } from 'vitest'

function chain<T>(result: T) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.select = self
  query.eq = self
  query.in = self
  query.order = self
  query.limit = self
  query.maybeSingle = async () => result
  query.then = (resolve: (value: T) => void) => resolve(result)
  return query
}

vi.mock('../../_lib/supabase-server.js', () => ({
  createUserClient: () => ({
    from: (table: string) => {
      if (table === 'venue_claims' || table === 'venue_staff') {
        return chain({ data: { id: 'ok' }, error: null })
      }
      if (table === 'pulses') {
        return chain({ data: [{ id: 'p1' }], error: null })
      }
      return chain({
        data: [{
          id: 'r1',
          pulse_id: 'p1',
          reporter_id: 'u2',
          reason: 'spam',
          details: null,
          created_at: '2026-09-12T01:00:00.000Z',
          status: 'pending',
          reviewed_at: null,
        }],
        error: null,
      })
    },
  }),
}))

vi.mock('../../_lib/auth.js', () => ({
  requireAuth: () => ({
    ok: true,
    context: { userId: 'owner-1', token: 'tok' },
  }),
  decodeJwt: () => ({ app_metadata: { role: 'user' } }),
}))

import handler from '../report.ts'

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

describe('GET /api/pulses/report?venueId=', () => {
  it('lists reports for a verified owner venue', async () => {
    const res = mockRes()
    await handler({
      method: 'GET',
      headers: {},
      query: { venueId: 'neumos' },
    } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(JSON.stringify(res.body)).toContain('p1')
  })
})
