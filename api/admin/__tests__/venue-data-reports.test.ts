/**
 * Unit tests for admin venue-data-reports queue:
 *   GET   /api/admin/venue-data-reports  — list by status
 *   PATCH /api/admin/venue-data-reports  — transition status
 *
 * Mirrors the mocking strategy in `venue-metadata.test.ts`: stub
 * `../../_lib/supabase-server` with a chainable client that records calls,
 * and build real base64url JWTs so `requireAuth` + `decodeJwt` read
 * `app_metadata.role` correctly.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

interface MockCallLog {
  table?: string
  select?: string
  eqCalls: { column: string; value: unknown }[]
  order?: { column: string; options: unknown }
  limit?: number
  update?: Record<string, unknown>
}

const mockCalls: MockCallLog[] = []
let mockListResponse: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
}
let mockUpdateResponse: { data: unknown; error: { message: string } | null } = {
  data: { id: 'report_1', status: 'reviewed' },
  error: null,
}

vi.mock('../../_lib/supabase-server', () => {
  return {
    createUserClient: () => buildStubClient(),
    getSupabaseConfig: () => ({ url: 'http://localhost', anonKey: 'anon' }),
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => buildStubClient(),
}))

function buildStubClient() {
  const call: MockCallLog = { eqCalls: [] }
  mockCalls.push(call)

  function selectChain() {
    return {
      eq(column: string, value: unknown) {
        call.eqCalls.push({ column, value })
        return selectChain()
      },
      order(column: string, options: unknown) {
        call.order = { column, options }
        return selectChain()
      },
      limit(n: number) {
        call.limit = n
        return Promise.resolve(mockListResponse)
      },
      single() {
        return Promise.resolve(mockUpdateResponse)
      },
    }
  }

  return {
    from(table: string) {
      call.table = table
      return {
        select(cols: string) {
          call.select = cols
          return selectChain()
        },
        update(row: Record<string, unknown>) {
          call.update = row
          return {
            eq(column: string, value: unknown) {
              call.eqCalls.push({ column, value })
              return {
                select(cols: string) {
                  call.select = cols
                  return {
                    single: () => Promise.resolve(mockUpdateResponse),
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}

import handler, { validatePatchBody } from '../venue-data-reports'

function b64url(s: string): string {
  return Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function buildJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(
    JSON.stringify({
      sub: 'user_abc',
      exp: Math.floor(Date.now() / 1000) + 600,
      ...payload,
    }),
  )
  return `${header}.${body}.sig`
}

function buildRequest(
  method: string,
  opts: { token?: string; body?: unknown; query?: Record<string, string> } = {},
): { method: string; headers: Record<string, string>; body?: unknown; query?: Record<string, string> } {
  return {
    method,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    body: opts.body,
    query: opts.query,
  }
}

function buildResponse() {
  const headers: Record<string, string> = {}
  const captured: { status: number; body: unknown } = { status: 0, body: undefined }
  return {
    captured,
    headers,
    res: {
      status(code: number) {
        captured.status = code
        return this
      },
      setHeader(name: string, value: string) {
        headers[name] = value
      },
      json(payload: unknown) {
        captured.body = payload
      },
      end() {
        // no-op
      },
    },
  }
}

beforeEach(() => {
  mockCalls.length = 0
  mockListResponse = { data: [], error: null }
  mockUpdateResponse = { data: { id: 'report_1', status: 'reviewed' }, error: null }
})

describe('validatePatchBody', () => {
  it('requires id', () => {
    const result = validatePatchBody({ status: 'reviewed' })
    expect(result.ok).toBe(false)
  })

  it('rejects unknown status', () => {
    const result = validatePatchBody({ id: 'r1', status: 'pending' })
    expect(result.ok).toBe(false)
  })

  it('accepts a valid payload', () => {
    const result = validatePatchBody({ id: 'r1', status: 'actioned' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ id: 'r1', status: 'actioned' })
  })
})

describe('GET /api/admin/venue-data-reports — handler', () => {
  it('rejects missing Authorization with 401', async () => {
    const { res, captured } = buildResponse()
    await handler(buildRequest('GET'), res)
    expect(captured.status).toBe(401)
  })

  it('rejects non-admin with 403', async () => {
    const token = buildJwt({ app_metadata: { role: 'user' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest('GET', { token }), res)
    expect(captured.status).toBe(403)
    expect(mockCalls).toHaveLength(0)
  })

  it('rejects methods other than GET/PATCH', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest('POST', { token }), res)
    expect(captured.status).toBe(405)
  })

  it('defaults to pending status and returns reports', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    mockListResponse = {
      data: [{ id: 'r1', status: 'pending', reason: 'wrong_hours' }],
      error: null,
    }
    const { res, captured } = buildResponse()
    await handler(buildRequest('GET', { token }), res)

    expect(captured.status).toBe(200)
    expect(mockCalls).toHaveLength(1)
    expect(mockCalls[0].table).toBe('venue_data_reports')
    expect(mockCalls[0].eqCalls).toEqual([{ column: 'status', value: 'pending' }])
    expect(captured.body).toMatchObject({
      data: { reports: [{ id: 'r1', status: 'pending' }] },
    })
  })

  it('rejects an invalid status filter with 400', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest('GET', { token, query: { status: 'bogus' } }), res)
    expect(captured.status).toBe(400)
  })

  it('honors an explicit status filter', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest('GET', { token, query: { status: 'dismissed' } }), res)
    expect(captured.status).toBe(200)
    expect(mockCalls[0].eqCalls).toEqual([{ column: 'status', value: 'dismissed' }])
  })

  it('surfaces a 500 when Supabase returns an error', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    mockListResponse = { data: null, error: { message: 'rls denied' } }
    const { res, captured } = buildResponse()
    await handler(buildRequest('GET', { token }), res)
    expect(captured.status).toBe(500)
  })
})

describe('PATCH /api/admin/venue-data-reports — handler', () => {
  it('rejects non-admin with 403', async () => {
    const token = buildJwt({ app_metadata: { role: 'user' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest('PATCH', { token, body: { id: 'r1', status: 'reviewed' } }), res)
    expect(captured.status).toBe(403)
    expect(mockCalls).toHaveLength(0)
  })

  it('rejects an invalid payload with 400', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest('PATCH', { token, body: { id: 'r1', status: 'pending' } }), res)
    expect(captured.status).toBe(400)
    expect(mockCalls).toHaveLength(0)
  })

  it('updates the report status and stamps reviewed_by/reviewed_at', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    mockUpdateResponse = {
      data: { id: 'r1', status: 'actioned', reviewed_by: 'user_abc' },
      error: null,
    }
    const { res, captured } = buildResponse()
    await handler(buildRequest('PATCH', { token, body: { id: 'r1', status: 'actioned' } }), res)

    expect(captured.status).toBe(200)
    expect(mockCalls).toHaveLength(1)
    const call = mockCalls[0]
    expect(call.table).toBe('venue_data_reports')
    expect(call.update).toMatchObject({ status: 'actioned', reviewed_by: 'user_abc' })
    expect(call.eqCalls).toEqual([{ column: 'id', value: 'r1' }])
    expect(captured.body).toMatchObject({ data: { id: 'r1', status: 'actioned' } })
  })

  it('surfaces a 500 when Supabase returns an error', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    mockUpdateResponse = { data: null, error: { message: 'rls denied' } }
    const { res, captured } = buildResponse()
    await handler(buildRequest('PATCH', { token, body: { id: 'r1', status: 'reviewed' } }), res)
    expect(captured.status).toBe(500)
  })
})
