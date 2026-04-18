/**
 * Dispatcher smoke tests for the AI Night Concierge tool backends.
 *
 * These tests intentionally exercise the real `executeToolCall` with
 * mocked Supabase + rideshare integrations, and assert each branch
 * returns a concrete shape (not the old `{ stub: true }` placeholder).
 *
 * Mocking strategy:
 *   - Supabase: `../supabase-server.createUserClient` is stubbed to
 *     return a chainable query builder that yields preset data/errors.
 *   - Uber/Lyft handlers: the integration modules are mocked to bypass
 *     their outbound fetch and write a canned payload onto the captured
 *     ResponseLike.
 *   - Moderation is NOT mocked — it's a pure function in the same lib.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

type ResolvedQuery = { data: unknown; error: { message: string } | null }

// Tables the mocked client should resolve from. Mutated per-test via
// `setTable(...)`. Shared across test files via globalThis so the
// hoisted `vi.mock` factories can reach it without capturing closures
// from this file (which would hit hoist-order errors).
interface GlobalMockBag {
  __conciergeMocks?: {
    tableResponses: Record<string, ResolvedQuery>
  }
}
const mockBag: NonNullable<GlobalMockBag['__conciergeMocks']> = {
  tableResponses: {},
}
;(globalThis as unknown as GlobalMockBag).__conciergeMocks = mockBag

const setTable = (name: string, value: ResolvedQuery): void => {
  mockBag.tableResponses[name] = value
}
const clearTables = (): void => {
  for (const key of Object.keys(mockBag.tableResponses)) {
    delete mockBag.tableResponses[key]
  }
}

vi.mock('../supabase-server', () => {
  // A chainable query builder: every method call returns the SAME proxy
  // so `.select().is().order().limit()` keeps threading through. `await`
  // (via `then`) yields the resolved `{ data, error }`, and
  // `.maybeSingle()` yields the first row.
  const makeQueryInner = (resolved: ResolvedQuery) => {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (
              onFulfilled: (r: ResolvedQuery) => unknown,
              onRejected?: (err: unknown) => unknown,
            ) => Promise.resolve(resolved).then(onFulfilled, onRejected)
          }
          if (prop === 'maybeSingle') {
            return () =>
              Promise.resolve({
                data: Array.isArray(resolved.data) ? resolved.data[0] ?? null : resolved.data,
                error: resolved.error,
              })
          }
          if (prop === 'single') {
            return () =>
              Promise.resolve({
                data: Array.isArray(resolved.data) ? resolved.data[0] ?? null : resolved.data,
                error: resolved.error,
              })
          }
          // Any other method call: return a function that returns the
          // same chainable so further `.x()` keeps working.
          return () => proxy
        },
      },
    )
    return proxy
  }
  const createUserClient = () => {
    const bag = (globalThis as unknown as GlobalMockBag).__conciergeMocks
    return {
      from: (table: string) => {
        const resolved = bag?.tableResponses[table] ?? { data: [], error: null }
        return makeQueryInner(resolved)
      },
      rpc: () => Promise.resolve({ data: null, error: null }),
    }
  }
  return { createUserClient }
})

vi.mock('../../integrations/uber', () => ({
  default: async (
    _req: unknown,
    res: { status: (n: number) => unknown; json: (p: unknown) => void; setHeader?: (n: string, v: string) => void; end?: () => void },
  ) => {
    res.status(200)
    res.json({
      data: {
        priceEstimates: [
          { display_name: 'UberX', low_estimate: 12, high_estimate: 16, currency_code: 'USD' },
          { display_name: 'UberXL', low_estimate: 22, high_estimate: 28, currency_code: 'USD' },
        ],
        timeEstimates: [{ estimate: 300 }],
      },
    })
  },
}))

vi.mock('../../integrations/lyft', () => ({
  default: async (
    _req: unknown,
    res: { status: (n: number) => unknown; json: (p: unknown) => void; setHeader?: (n: string, v: string) => void; end?: () => void },
  ) => {
    res.status(200)
    res.json({
      data: {
        costEstimates: [
          {
            ride_type: 'lyft_standard',
            estimated_cost_cents_min: 1100,
            estimated_cost_cents_max: 1500,
            currency: 'USD',
          },
        ],
        etaEstimates: [{ eta_seconds: 240 }],
      },
    })
  },
}))

/* ------------------------------------------------------------------ */
/* Import under test AFTER mocks are declared.                         */
/* ------------------------------------------------------------------ */

import { executeToolCall, type ConciergeToolContext } from '../concierge-tools'

function parse(content: string): Record<string, unknown> {
  return JSON.parse(content) as Record<string, unknown>
}

const baseCtx: ConciergeToolContext = {
  userId: 'user-abc',
  userJwt: 'jwt-xyz',
  userContext: { location: { lat: 40.72, lng: -73.95 } },
}

beforeEach(() => {
  clearTables()
})

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe('executeToolCall — search_venues', () => {
  it('returns ranked venues from Supabase (not a stub)', async () => {
    setTable('venues', {
      data: [
        {
          id: 'v1',
          name: 'Rooftop Bar',
          location_lat: 40.72,
          location_lng: -73.95,
          location_address: '1 Main St',
          city: 'Brooklyn',
          category: 'bar',
          pulse_score: 88,
          cover_charge_cents: 0,
        },
        {
          id: 'v2',
          name: 'Far Away Club',
          location_lat: 41.0,
          location_lng: -74.5,
          location_address: '99 Far Ave',
          city: 'Elsewhere',
          category: 'club',
          pulse_score: 90,
          cover_charge_cents: 2500,
        },
      ],
      error: null,
    })

    const result = await executeToolCall('search_venues', { vibe: 'rooftop' }, baseCtx)
    const payload = parse(result.content)
    expect(payload.stub).toBeUndefined()
    expect(payload.count).toBe(2)
    const results = payload.results as Array<Record<string, unknown>>
    expect(results[0]).toMatchObject({ id: 'v1', name: 'Rooftop Bar', pulseScore: 88 })
    // v1 is closer than v2 so despite lower pulseScore, distance penalty
    // makes it rank first.
    expect(results[0].id).toBe('v1')
    expect(typeof results[0].distanceMi).toBe('number')
  })

  it('surfaces DB errors as structured { error } content', async () => {
    setTable('venues', { data: null, error: { message: 'rls denied' } })
    const result = await executeToolCall('search_venues', {}, baseCtx)
    const payload = parse(result.content)
    expect(result.isError).toBe(true)
    expect(payload.error).toMatchObject({ code: 'db_error', message: 'rls denied' })
  })
})

describe('executeToolCall — build_plan', () => {
  it('returns a real NightPlan with stops from Supabase', async () => {
    setTable('venues', {
      data: [
        {
          id: 'v1',
          name: 'Dinner Spot',
          location_lat: 40.72,
          location_lng: -73.95,
          location_address: '1 Main St',
          city: 'Brooklyn',
          category: 'restaurant',
          pulse_score: 70,
          cover_charge_cents: null,
        },
        {
          id: 'v2',
          name: 'Cocktail Den',
          location_lat: 40.722,
          location_lng: -73.952,
          location_address: '2 Side St',
          city: 'Brooklyn',
          category: 'cocktail_bar',
          pulse_score: 75,
          cover_charge_cents: null,
        },
        {
          id: 'v3',
          name: 'Late Lounge',
          location_lat: 40.724,
          location_lng: -73.954,
          location_address: '3 Back Ln',
          city: 'Brooklyn',
          category: 'lounge',
          pulse_score: 65,
          cover_charge_cents: null,
        },
      ],
      error: null,
    })
    setTable('pulses', { data: [], error: null })

    const input = {
      groupSize: 4,
      budgetPerPerson: 80,
      startTime: new Date('2026-05-01T19:30:00Z').toISOString(),
      endTime: new Date('2026-05-02T01:00:00Z').toISOString(),
      location: { lat: 40.72, lng: -73.95 },
      preferences: { vibes: ['classy'], musicGenres: [], venueTypes: [], avoidCategories: [] },
    }
    const result = await executeToolCall('build_plan', input, baseCtx)
    const payload = parse(result.content)
    expect(payload.stub).toBeUndefined()
    expect(payload.plan).toBeTruthy()
    const plan = payload.plan as Record<string, unknown>
    expect(Array.isArray(plan.stops)).toBe(true)
    expect((plan.stops as unknown[]).length).toBeGreaterThanOrEqual(2)
    expect(plan.budget).toMatchObject({ perPerson: 80 })
  })

  it('errors when the venue pool is empty', async () => {
    setTable('venues', { data: [], error: null })
    setTable('pulses', { data: [], error: null })
    const result = await executeToolCall(
      'build_plan',
      {
        groupSize: 2,
        budgetPerPerson: 50,
        startTime: '2026-05-01T19:00:00Z',
        endTime: '2026-05-02T00:00:00Z',
        location: { lat: 40.72, lng: -73.95 },
      },
      baseCtx,
    )
    const payload = parse(result.content)
    expect(result.isError).toBe(true)
    expect(payload.error).toMatchObject({ code: 'no_venues' })
  })
})

describe('executeToolCall — estimate_rideshare', () => {
  it('normalises Uber + Lyft payloads into a shared shape', async () => {
    const result = await executeToolCall(
      'estimate_rideshare',
      { pickup: { lat: 40.72, lng: -73.95 }, dropoff: { lat: 40.74, lng: -73.99 } },
      baseCtx,
    )
    const payload = parse(result.content)
    expect(payload.stub).toBeUndefined()
    expect(payload.uber).toMatchObject({ lowEstimate: 12, highEstimate: 16, eta: 5, currency: 'USD' })
    expect(payload.lyft).toMatchObject({ lowEstimate: 11, highEstimate: 15, eta: 4, currency: 'USD' })
  })

  it('rejects invalid pickup/dropoff as a structured error', async () => {
    const result = await executeToolCall('estimate_rideshare', { pickup: 'nope' }, baseCtx)
    const payload = parse(result.content)
    expect(result.isError).toBe(true)
    expect(payload.error).toMatchObject({ code: 'bad_input' })
  })
})

describe('executeToolCall — check_surge', () => {
  it('returns a prediction from recent pulses', async () => {
    const now = Date.now()
    setTable('pulses', {
      data: [
        {
          id: 'p1',
          venue_id: 'v1',
          energy_rating: 'buzzing',
          created_at: new Date(now - 1000 * 60 * 60 * 24 * 7).toISOString(),
          expires_at: new Date(now + 1000 * 60 * 60).toISOString(),
        },
        {
          id: 'p2',
          venue_id: 'v1',
          energy_rating: 'electric',
          created_at: new Date(now - 1000 * 60 * 60 * 24 * 14).toISOString(),
          expires_at: new Date(now + 1000 * 60 * 60).toISOString(),
        },
      ],
      error: null,
    })
    const result = await executeToolCall(
      'check_surge',
      { venueId: 'v1', atTime: new Date(now).toISOString() },
      baseCtx,
    )
    const payload = parse(result.content)
    expect(payload.stub).toBeUndefined()
    expect(payload.venueId).toBe('v1')
    expect(payload.predictedEnergy).toMatch(/^(dead|chill|buzzing|electric)$/)
    expect(typeof payload.confidence).toBe('number')
    expect(payload.sampleSize).toBe(2)
  })

  it('fails fast without a venue id', async () => {
    const result = await executeToolCall('check_surge', {}, baseCtx)
    const payload = parse(result.content)
    expect(result.isError).toBe(true)
    expect(payload.error).toMatchObject({ code: 'bad_input' })
  })
})

describe('executeToolCall — check_moderation', () => {
  it('returns a real { allowed, reasons, severity } payload', async () => {
    const result = await executeToolCall(
      'check_moderation',
      { content: 'Let us grab drinks at 9pm', kind: 'comment' },
      baseCtx,
    )
    const payload = parse(result.content)
    expect(payload.stub).toBeUndefined()
    expect(payload.allowed).toBe(true)
    expect(Array.isArray(payload.reasons)).toBe(true)
    expect(['low', 'med', 'high']).toContain(payload.severity)
    expect(typeof payload.sanitized).toBe('string')
  })

  it('blocks content flagged by the engine', async () => {
    const result = await executeToolCall(
      'check_moderation',
      { content: 'Visit http://shady.ru now for free money!!!', kind: 'comment' },
      baseCtx,
    )
    const payload = parse(result.content)
    expect(payload.allowed).toBe(false)
    expect((payload.reasons as string[]).length).toBeGreaterThan(0)
  })
})

describe('executeToolCall — unknown tool', () => {
  it('returns an unknown_tool error instead of throwing', async () => {
    const result = await executeToolCall('make_coffee', {}, baseCtx)
    const payload = parse(result.content)
    expect(result.isError).toBe(true)
    expect(payload.error).toMatchObject({ code: 'unknown_tool' })
  })
})
