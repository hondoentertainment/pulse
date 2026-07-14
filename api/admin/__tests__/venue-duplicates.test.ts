/**
 * Unit tests for GET /api/admin/venue-duplicates.
 *
 * Mirrors the mocking strategy in `venue-metadata.test.ts` / `venues-completeness`
 * tests: stub `../../_lib/supabase-server` with a chainable client, build
 * real base64url JWTs for `requireAuth` + `decodeJwt`, and assert both the
 * auth gate and the grouping behavior end-to-end through the handler.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

interface MockCallLog {
  table?: string
  select?: string
  isCalls: { column: string; value: unknown }[]
  ilikeCalls: { column: string; value: unknown }[]
  limit?: number
}

const mockCalls: MockCallLog[] = []
let mockListResponse: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
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
  const call: MockCallLog = { isCalls: [], ilikeCalls: [] }
  mockCalls.push(call)

  // Mirrors the real Supabase query builder: every step stays chainable
  // *and* is directly awaitable (thenable), matching the handler's
  // `let query = ...; if (city) query = query.ilike(...); await query` shape.
  function chain(): PromiseLike<typeof mockListResponse> & Record<string, (...args: unknown[]) => unknown> {
    const builder = {
      is(column: string, value: unknown) {
        call.isCalls.push({ column, value })
        return chain()
      },
      ilike(column: string, value: unknown) {
        call.ilikeCalls.push({ column, value })
        return chain()
      },
      limit(n: number) {
        call.limit = n
        return chain()
      },
      then(
        onFulfilled?: ((value: typeof mockListResponse) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) {
        return Promise.resolve(mockListResponse).then(onFulfilled ?? undefined, onRejected ?? undefined)
      },
    }
    return builder as unknown as PromiseLike<typeof mockListResponse> & Record<string, (...args: unknown[]) => unknown>
  }

  return {
    from(table: string) {
      call.table = table
      return {
        select(cols: string) {
          call.select = cols
          return chain()
        },
      }
    },
  }
}

import handler from '../venue-duplicates'

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
  opts: { token?: string; query?: Record<string, string> } = {},
): { method: string; headers: Record<string, string>; query?: Record<string, string> } {
  return {
    method: 'GET',
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
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
})

describe('GET /api/admin/venue-duplicates — handler', () => {
  it('rejects missing Authorization with 401', async () => {
    const { res, captured } = buildResponse()
    await handler(buildRequest(), res)
    expect(captured.status).toBe(401)
  })

  it('rejects non-admin with 403', async () => {
    const token = buildJwt({ app_metadata: { role: 'user' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest({ token }), res)
    expect(captured.status).toBe(403)
    expect(mockCalls).toHaveLength(0)
  })

  it('rejects methods other than GET', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` } }, res)
    expect(captured.status).toBe(405)
  })

  it('scans venues and returns an empty group list when nothing overlaps', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    mockListResponse = {
      data: [
        { id: 'a', name: 'Neumos', city: 'Seattle', location_lat: 47.6145, location_lng: -122.3205, location_address: '925 E Pike St' },
        { id: 'b', name: 'Barboza', city: 'Seattle', location_lat: 47.5, location_lng: -122.5, location_address: '123 Somewhere Ave' },
      ],
      error: null,
    }
    const { res, captured } = buildResponse()
    await handler(buildRequest({ token }), res)

    expect(captured.status).toBe(200)
    expect(mockCalls[0].table).toBe('venues')
    expect(mockCalls[0].isCalls).toEqual([{ column: 'deleted_at', value: null }])
    expect(captured.body).toMatchObject({ data: { scanned: 2, groupCount: 0, groups: [] } })
  })

  it('groups venues with the same normalized name', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    mockListResponse = {
      data: [
        { id: 'a', name: 'The Crocodile', city: 'Seattle', location_lat: 47.6162, location_lng: -122.3488, location_address: '2200 2nd Ave' },
        { id: 'b', name: 'Crocodile', city: 'Seattle', location_lat: 10, location_lng: 10, location_address: 'far away' },
      ],
      error: null,
    }
    const { res, captured } = buildResponse()
    await handler(buildRequest({ token }), res)

    expect(captured.status).toBe(200)
    const body = captured.body as { data: { groupCount: number; groups: { reasons: string[]; venues: { id: string }[] }[] } }
    expect(body.data.groupCount).toBe(1)
    expect(body.data.groups[0].reasons).toContain('same_name')
    expect(body.data.groups[0].venues.map((v) => v.id).sort()).toEqual(['a', 'b'])
  })

  it('filters by city when provided', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest({ token, query: { city: 'Seattle' } }), res)
    expect(captured.status).toBe(200)
    expect(mockCalls[0].ilikeCalls).toEqual([{ column: 'city', value: 'Seattle' }])
  })

  it('surfaces a 500 when Supabase returns an error', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    mockListResponse = { data: null, error: { message: 'rls denied' } }
    const { res, captured } = buildResponse()
    await handler(buildRequest({ token }), res)
    expect(captured.status).toBe(500)
  })
})
