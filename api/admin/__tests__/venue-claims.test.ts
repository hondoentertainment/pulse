import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  selects: [] as string[],
  updates: [] as Record<string, unknown>[],
  role: 'admin',
}))

const FORBIDDEN_CLAIM_KEYS = [
  'user_id',
  'evidence',
  'notes',
  'work_email',
  'work_email_confirmed_at',
] as const

vi.mock('../../_lib/supabase-server.js', () => {
  const pending = {
    id: 'c1',
    venue_id: 'v1',
    user_id: 'user-9',
    status: 'pending',
    evidence: 'I own the lease',
    notes: 'call the gm',
    work_email: 'gm@neumos.com',
    work_email_confirmed_at: '2026-09-01T00:00:00.000Z',
    created_at: '2026-09-12T01:00:00.000Z',
    reviewed_at: '2026-09-12T02:00:00.000Z',
    venues: {
      name: 'Neumos',
      neighborhood: 'Capitol Hill',
      owner_email_domain: 'neumos.com',
    },
  }
  const query = {
    order: () => query,
    limit: () => query,
    eq: () => query,
    then: (resolve: (value: { data: unknown; error: null }) => void) => {
      resolve({ data: [pending], error: null })
    },
  }
  return {
    createUserClient: () => ({
      from: () => ({
        select: (cols: string) => {
          calls.selects.push(cols)
          return query
        },
        update: (payload: Record<string, unknown>) => {
          calls.updates.push(payload)
          return {
            eq: () => ({
              select: (cols: string) => {
                calls.selects.push(cols)
                return {
                  single: async () => ({
                    data: {
                      id: 'c1',
                      venue_id: 'v1',
                      user_id: 'user-9',
                      status: calls.updates.at(-1)?.status ?? 'verified',
                      evidence: 'I own the lease',
                      notes: typeof calls.updates.at(-1)?.notes === 'string'
                        ? calls.updates.at(-1)?.notes
                        : 'call the gm',
                      work_email: 'gm@neumos.com',
                      reviewed_at: '2026-09-12T02:00:00.000Z',
                    },
                    error: null,
                  }),
                }
              },
            }),
          }
        },
      }),
    }),
  }
})

vi.mock('../../_lib/auth.js', () => ({
  requireAuth: () => ({
    ok: true,
    context: { userId: 'admin-1', token: 'tok' },
  }),
  decodeJwt: () => ({ app_metadata: { role: calls.role } }),
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

function assertClaimSecretsAbsent(body: unknown) {
  const json = JSON.stringify(body)
  for (const key of FORBIDDEN_CLAIM_KEYS) {
    expect(json).not.toContain(`"${key}"`)
  }
  expect(json).not.toContain('user-9')
  expect(json).not.toContain('I own the lease')
  expect(json).not.toContain('call the gm')
  expect(json).not.toContain('gm@neumos.com')
  expect(json).not.toContain('neumos.com')
  expect(json).not.toContain('owner_email_domain')
}

describe('GET /api/admin/venue-claims', () => {
  beforeEach(() => {
    calls.selects.length = 0
    calls.updates.length = 0
    calls.role = 'admin'
  })

  it('lists venue name, neighborhood, status, and submitted time only', async () => {
    const res = mockRes()
    await handler({ method: 'GET', headers: {}, query: { status: 'pending' } } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(calls.selects).toEqual([
      'id, venue_id, status, created_at, venues(name, neighborhood)',
    ])
    expect(res.body).toEqual({
      data: {
        claims: [{
          id: 'c1',
          venue_id: 'v1',
          status: 'pending',
          created_at: '2026-09-12T01:00:00.000Z',
          venue_name: 'Neumos',
          neighborhood: 'Capitol Hill',
        }],
      },
    })
    assertClaimSecretsAbsent(res.body)
  })

  it('rejects a non-admin before selecting claims', async () => {
    calls.role = 'user'
    const res = mockRes()
    await handler({ method: 'GET', headers: {}, query: { status: 'pending' } } as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(JSON.stringify(res.body)).toMatch(/Admin role required/)
    expect(calls.selects).toEqual([])
  })
})

describe('PATCH /api/admin/venue-claims', () => {
  beforeEach(() => {
    calls.selects.length = 0
    calls.updates.length = 0
    calls.role = 'admin'
  })

  it('verifies a claim without returning evidence, notes, user id, or work email', async () => {
    const res = mockRes()
    await handler({
      method: 'PATCH',
      headers: {},
      body: { claimId: 'c1', status: 'verified' },
    } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(calls.selects).toEqual(['id, venue_id, status, reviewed_at'])
    expect(calls.updates[0]).toMatchObject({ status: 'verified' })
    expect(calls.updates[0]).not.toHaveProperty('notes')
    expect(res.body).toEqual({
      data: {
        claim: {
          id: 'c1',
          venue_id: 'v1',
          status: 'verified',
          reviewed_at: '2026-09-12T02:00:00.000Z',
        },
      },
    })
    assertClaimSecretsAbsent(res.body)
  })

  it('stores a reject note and leaves it out of the response', async () => {
    const res = mockRes()
    await handler({
      method: 'PATCH',
      headers: {},
      body: { claimId: 'c1', status: 'rejected', notes: 'Rejected from /ops' },
    } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(calls.updates[0]).toMatchObject({
      status: 'rejected',
      notes: 'Rejected from /ops',
    })
    expect(JSON.stringify(res.body)).not.toContain('Rejected from /ops')
    assertClaimSecretsAbsent(res.body)
    expect(res.body).toEqual({
      data: {
        claim: {
          id: 'c1',
          venue_id: 'v1',
          status: 'rejected',
          reviewed_at: '2026-09-12T02:00:00.000Z',
        },
      },
    })
  })
})
