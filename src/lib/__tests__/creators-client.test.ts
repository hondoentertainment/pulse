import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

// Mock supabase session BEFORE importing the module under test.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
}))

import {
  applyForCreator,
  applyReferralCode,
  createReferralCode,
  deactivateReferralCode,
  getCreatorMe,
  listReferralCodes,
} from '@/lib/creators-client'

interface MockCall {
  url: string
  init: RequestInit
}

let calls: MockCall[] = []
let nextResponse: { status: number; body: unknown } = { status: 200, body: { data: {} } }

beforeEach(() => {
  calls = []
  nextResponse = { status: 200, body: { data: {} } }
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify(nextResponse.body), {
      status: nextResponse.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('creators-client HTTP contracts', () => {
  it('applyForCreator POSTs to /api/creators/apply with bearer', async () => {
    nextResponse = { status: 201, body: { data: { id: 'ver_1' } } }
    await applyForCreator({
      handle: 'alice',
      social_links: ['https://ig.com/a'],
      content_samples: [],
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/creators/apply')
    expect(calls[0].init.method).toBe('POST')
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(calls[0].init.body).toContain('alice')
  })

  it('getCreatorMe GETs /api/creators/me and returns data', async () => {
    nextResponse = {
      status: 200,
      body: {
        data: {
          profile: null,
          stats: {
            lifetime_earnings_cents: 0,
            held_cents: 0,
            paid_cents: 0,
            pending_attributions: 0,
            total_attributions: 0,
            active_codes: 0,
          },
        },
      },
    }
    const out = await getCreatorMe()
    expect(calls[0].url).toBe('/api/creators/me')
    expect(calls[0].init.method).toBe('GET')
    expect(out.stats.lifetime_earnings_cents).toBe(0)
  })

  it('createReferralCode POSTs and expects 201', async () => {
    nextResponse = { status: 201, body: { data: { code: 'ABCDEF' } } }
    const out = await createReferralCode()
    expect(out).toEqual({ code: 'ABCDEF' })
    expect(calls[0].url).toBe('/api/creators/referral-codes')
    expect(calls[0].init.method).toBe('POST')
  })

  it('listReferralCodes GETs and returns an array', async () => {
    nextResponse = { status: 200, body: { data: [] } }
    const out = await listReferralCodes()
    expect(Array.isArray(out)).toBe(true)
    expect(calls[0].url).toBe('/api/creators/referral-codes')
    expect(calls[0].init.method).toBe('GET')
  })

  it('deactivateReferralCode DELETEs with the code in the query string', async () => {
    nextResponse = { status: 200, body: { data: { code: 'XYZ123' } } }
    await deactivateReferralCode('XYZ123')
    expect(calls[0].url).toBe('/api/creators/referral-codes?code=XYZ123')
    expect(calls[0].init.method).toBe('DELETE')
  })

  it('applyReferralCode POSTs to /api/creators/apply-referral', async () => {
    nextResponse = { status: 201, body: { data: { id: 'attr_1' } } }
    await applyReferralCode('ABCDEF')
    expect(calls[0].url).toBe('/api/creators/apply-referral')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.body).toContain('ABCDEF')
  })

  it('throws with server error message on non-2xx', async () => {
    nextResponse = { status: 400, body: { error: 'invalid code format' } }
    await expect(applyReferralCode('nope')).rejects.toThrow(/invalid code format/)
  })

  it('throws a generic message when no session', async () => {
    // Override the supabase mock for this one case.
    const mod = await import('@/lib/supabase')
    ;(mod.supabase.auth.getSession as unknown) = async () => ({
      data: { session: null },
    })
    await expect(getCreatorMe()).rejects.toThrow(/Not authenticated/)
    // restore for subsequent tests (not strictly needed, each `it` rebuilds fetch mock)
    ;(mod.supabase.auth.getSession as unknown) = async () => ({
      data: { session: { access_token: 'test-token' } },
    })
  })
})
