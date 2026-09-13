import { beforeEach, describe, expect, it, vi } from 'vitest'

type QueryResult = { data: unknown; error: null }

const { access } = vi.hoisted(() => ({
  access: {
    claim: null as { id: string } | null,
    staff: null as { user_id: string } | null,
    pulse: { id: 'p1', venue_id: 'neumos' } as { id: string; venue_id: string },
    reports: [{
      id: 'r1',
      pulse_id: 'p1',
      reporter_id: 'u2',
      reason: 'spam',
      details: null,
      created_at: '2026-09-12T01:00:00.000Z',
      status: 'pending',
      reviewed_at: null,
    }],
  },
}))

function chain(result: QueryResult) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.select = self
  query.eq = self
  query.in = self
  query.order = self
  query.limit = self
  query.update = self
  query.maybeSingle = async () => result
  query.single = async () => result
  query.then = (resolve: (value: QueryResult) => void) => resolve(result)
  return query
}

vi.mock('../../_lib/supabase-server.js', () => ({
  createUserClient: () => ({
    from: (table: string) => {
      if (table === 'venue_claims') {
        return chain({ data: access.claim, error: null })
      }
      if (table === 'venue_staff') {
        return chain({ data: access.staff, error: null })
      }
      if (table === 'pulses') {
        const query = chain({
          data: { id: access.pulse.id, venue_id: access.pulse.venue_id },
          error: null,
        })
        query.then = (resolve: (value: QueryResult) => void) => resolve({
          data: [{ id: access.pulse.id }],
          error: null,
        })
        return query
      }
      return chain({ data: access.reports, error: null })
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

describe('/api/pulses/report venue inbox access', () => {
  beforeEach(() => {
    access.claim = null
    access.staff = null
  })

  it('lists reports for a verified owner venue', async () => {
    access.claim = { id: 'ok' }
    const res = mockRes()
    await handler({
      method: 'GET',
      headers: {},
      query: { venueId: 'neumos' },
    } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(JSON.stringify(res.body)).toContain('p1')
  })

  it('rejects a pending claim from listing venue reports', async () => {
    const res = mockRes()
    await handler({
      method: 'GET',
      headers: {},
      query: { venueId: 'neumos' },
    } as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(JSON.stringify(res.body)).toMatch(/Verified owner or admin required/)
  })

  it('rejects a pending claim from dismissing reports', async () => {
    const res = mockRes()
    await handler({
      method: 'PATCH',
      headers: {},
      body: { pulseId: 'p1', status: 'dismissed' },
    } as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(JSON.stringify(res.body)).toMatch(/Verified claim required/)
  })

  it('allows a verified owner to dismiss by pulseId', async () => {
    access.claim = { id: 'ok' }
    const res = mockRes()
    await handler({
      method: 'PATCH',
      headers: {},
      body: { pulseId: 'p1', status: 'dismissed' },
    } as never, res as never)
    expect(res.statusCode).toBe(200)
  })
})
