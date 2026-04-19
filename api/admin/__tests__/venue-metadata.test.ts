/**
 * Unit tests for the admin-only POST /api/admin/venue-metadata handler.
 *
 * Strategy:
 *   - Mock `../../_lib/supabase-server` so `buildSupabaseClient` returns a
 *     chainable stub that records the `.update(...).eq(...).select(...)`
 *     calls, and we can assert the handler wrote the right row.
 *   - Build real Supabase-style JWTs (base64url-encoded header/payload) so
 *     `requireAuth` + `decodeJwt` read `app_metadata.role` correctly.
 *
 * The validateBody / buildUpdateRow helpers are also unit-tested directly
 * so we can cover the validation lattice without going through auth.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────────────────
// Mocks — declared before the import under test.
// ──────────────────────────────────────────────────────────────

interface MockCallLog {
  table?: string
  update?: Record<string, unknown>
  eq?: { column: string; value: unknown }
  select?: string
}

const mockCalls: MockCallLog[] = []
let mockDbResponse: { data: unknown; error: { message: string } | null } = {
  data: { id: 'venue_1' },
  error: null,
}

vi.mock('../../_lib/supabase-server', () => {
  return {
    createUserClient: () => buildStubClient(),
    getSupabaseConfig: () => ({ url: 'http://localhost', anonKey: 'anon' }),
  }
})

// Stub @supabase/supabase-js ONLY for the service-role fallback path. The
// user-JWT path goes through the mocked `createUserClient` above.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => buildStubClient(),
}))

function buildStubClient() {
  const call: MockCallLog = {}
  mockCalls.push(call)
  return {
    from(table: string) {
      call.table = table
      return {
        update(row: Record<string, unknown>) {
          call.update = row
          return {
            eq(column: string, value: unknown) {
              call.eq = { column, value }
              return {
                select(cols: string) {
                  call.select = cols
                  return {
                    single: () => Promise.resolve(mockDbResponse),
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

// ──────────────────────────────────────────────────────────────
// Module under test
// ──────────────────────────────────────────────────────────────

import handler, {
  buildUpdateRow,
  validateBody,
} from '../venue-metadata'

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

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
  // Signature is irrelevant for our local decode.
  return `${header}.${body}.sig`
}

function buildRequest(
  body: unknown,
  token?: string,
): { method: string; headers: Record<string, string>; body: unknown } {
  return {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
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
  mockDbResponse = { data: { id: 'venue_1' }, error: null }
})

// ──────────────────────────────────────────────────────────────
// validateBody unit tests
// ──────────────────────────────────────────────────────────────

describe('validateBody', () => {
  it('requires venue_id', () => {
    const result = validateBody({ dress_code: 'casual' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('venue_id'))).toBe(true)
    }
  })

  it('rejects unknown dress_code', () => {
    const result = validateBody({ venue_id: 'v1', dress_code: 'steampunk' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('dress_code'))).toBe(true)
    }
  })

  it('rejects negative cover_charge_cents', () => {
    const result = validateBody({ venue_id: 'v1', cover_charge_cents: -5 })
    expect(result.ok).toBe(false)
  })

  it('rejects over-long cover_charge_note', () => {
    const result = validateBody({
      venue_id: 'v1',
      cover_charge_note: 'x'.repeat(121),
    })
    expect(result.ok).toBe(false)
  })

  it('rejects unsupported accessibility values', () => {
    const result = validateBody({
      venue_id: 'v1',
      accessibility_features: ['wheelchair_accessible', 'lava_lamps'],
    })
    expect(result.ok).toBe(false)
  })

  it('accepts a fully-populated valid payload', () => {
    const result = validateBody({
      venue_id: 'v1',
      dress_code: 'upscale',
      cover_charge_cents: 2500,
      cover_charge_note: 'Free before 11pm',
      accessibility_features: ['wheelchair_accessible', 'wheelchair_accessible', 'step_free_entry'],
      indoor_outdoor: 'both',
      capacity_hint: 120,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.dress_code).toBe('upscale')
      expect(result.value.accessibility_features).toEqual([
        'wheelchair_accessible',
        'step_free_entry',
      ])
    }
  })

  it('passes explicit nulls through (clear-field)', () => {
    const result = validateBody({
      venue_id: 'v1',
      dress_code: null,
      cover_charge_cents: null,
      cover_charge_note: null,
      indoor_outdoor: null,
      capacity_hint: null,
    })
    expect(result.ok).toBe(true)
  })
})

describe('buildUpdateRow', () => {
  it('only emits fields that were present', () => {
    const row = buildUpdateRow({ venue_id: 'v1', dress_code: 'casual' })
    expect(row).toEqual({ dress_code: 'casual' })
  })

  it('converts nulls into nulls so the DB column clears', () => {
    const row = buildUpdateRow({
      venue_id: 'v1',
      dress_code: null,
      cover_charge_note: null,
    })
    expect(row).toEqual({ dress_code: null, cover_charge_note: null })
  })
})

// ──────────────────────────────────────────────────────────────
// handler integration tests
// ──────────────────────────────────────────────────────────────

describe('POST /api/admin/venue-metadata — handler', () => {
  it('rejects missing Authorization with 401', async () => {
    const { res, captured } = buildResponse()
    await handler(buildRequest({ venue_id: 'v1' }), res)
    expect(captured.status).toBe(401)
  })

  it('rejects non-admin with 403', async () => {
    const token = buildJwt({ app_metadata: { role: 'user' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest({ venue_id: 'v1', dress_code: 'casual' }, token), res)
    expect(captured.status).toBe(403)
    expect(mockCalls).toHaveLength(0)
  })

  it('rejects methods other than POST', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    await handler(
      { method: 'GET', headers: { authorization: `Bearer ${token}` }, body: {} },
      res,
    )
    expect(captured.status).toBe(405)
  })

  it('rejects invalid payload with 400 and does not call Supabase', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest({ venue_id: 'v1', dress_code: 'foo' }, token), res)
    expect(captured.status).toBe(400)
    expect(mockCalls).toHaveLength(0)
  })

  it('returns 400 when no updatable fields are supplied', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    await handler(buildRequest({ venue_id: 'v1' }, token), res)
    expect(captured.status).toBe(400)
  })

  it('writes the row on a valid admin payload', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    mockDbResponse = {
      data: {
        id: 'venue_1',
        dress_code: 'upscale',
        cover_charge_cents: 2500,
        cover_charge_note: 'Free before 11pm',
        accessibility_features: ['wheelchair_accessible'],
        indoor_outdoor: 'both',
        capacity_hint: 120,
      },
      error: null,
    }

    await handler(
      buildRequest(
        {
          venue_id: 'venue_1',
          dress_code: 'upscale',
          cover_charge_cents: 2500,
          cover_charge_note: 'Free before 11pm',
          accessibility_features: ['wheelchair_accessible'],
          indoor_outdoor: 'both',
          capacity_hint: 120,
        },
        token,
      ),
      res,
    )

    expect(captured.status).toBe(200)
    expect(mockCalls).toHaveLength(1)
    const call = mockCalls[0]
    expect(call.table).toBe('venues')
    expect(call.eq).toEqual({ column: 'id', value: 'venue_1' })
    expect(call.update).toMatchObject({
      dress_code: 'upscale',
      cover_charge_cents: 2500,
      cover_charge_note: 'Free before 11pm',
      accessibility_features: ['wheelchair_accessible'],
      indoor_outdoor: 'both',
      capacity_hint: 120,
    })
    expect(captured.body).toMatchObject({ data: { id: 'venue_1', dress_code: 'upscale' } })
  })

  it('surfaces a 500 when Supabase returns an error', async () => {
    const token = buildJwt({ app_metadata: { role: 'admin' } })
    const { res, captured } = buildResponse()
    mockDbResponse = { data: null, error: { message: 'rls denied' } }

    await handler(buildRequest({ venue_id: 'v1', dress_code: 'casual' }, token), res)
    expect(captured.status).toBe(500)
    expect(captured.body).toMatchObject({
      error: { code: 'persist_failed', details: 'rls denied' },
    })
  })

  it('accepts top-level role=admin (no nested app_metadata) as a fallback', async () => {
    const token = buildJwt({ role: 'admin' })
    const { res, captured } = buildResponse()
    await handler(buildRequest({ venue_id: 'v1', dress_code: 'casual' }, token), res)
    expect(captured.status).toBe(200)
  })
})
