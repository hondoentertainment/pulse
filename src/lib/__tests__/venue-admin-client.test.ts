/**
 * Unit tests for the client-side admin wrapper `updateVenueMetadata` and
 * its pre-network validator. The server also validates; we double-gate
 * client-side so UX / tests fail fast with a clear message.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'admin-token' } },
      }),
    },
  },
}))

import {
  COVER_CHARGE_NOTE_MAX,
  updateVenueMetadata,
  validateVenueMetadataPayload,
} from '@/lib/venue-admin-client'

describe('validateVenueMetadataPayload', () => {
  it('accepts an empty object (no fields to touch)', () => {
    const out = validateVenueMetadataPayload({})
    expect(out.ok).toBe(true)
  })

  it('rejects an unknown dress_code', () => {
    const out = validateVenueMetadataPayload({ dress_code: 'nope' })
    expect(out.ok).toBe(false)
  })

  it('rejects negative cover_charge_cents', () => {
    const out = validateVenueMetadataPayload({ cover_charge_cents: -1 })
    expect(out.ok).toBe(false)
  })

  it('rejects non-integer cover_charge_cents', () => {
    const out = validateVenueMetadataPayload({ cover_charge_cents: 12.5 })
    expect(out.ok).toBe(false)
  })

  it('rejects a cover_charge_note over the max length', () => {
    const out = validateVenueMetadataPayload({
      cover_charge_note: 'x'.repeat(COVER_CHARGE_NOTE_MAX + 1),
    })
    expect(out.ok).toBe(false)
  })

  it('rejects accessibility_features that are not an array', () => {
    const out = validateVenueMetadataPayload({ accessibility_features: 'oops' as unknown })
    expect(out.ok).toBe(false)
  })

  it('rejects an unknown accessibility feature', () => {
    const out = validateVenueMetadataPayload({
      accessibility_features: ['wheelchair_accessible', 'magic_carpet'],
    })
    expect(out.ok).toBe(false)
  })

  it('dedupes accessibility_features', () => {
    const out = validateVenueMetadataPayload({
      accessibility_features: ['wheelchair_accessible', 'wheelchair_accessible', 'step_free_entry'],
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.value.accessibility_features).toEqual([
        'wheelchair_accessible',
        'step_free_entry',
      ])
    }
  })

  it('passes through explicit nulls (clear field)', () => {
    const out = validateVenueMetadataPayload({
      dress_code: null,
      cover_charge_cents: null,
      capacity_hint: null,
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.value.dress_code).toBeNull()
      expect(out.value.cover_charge_cents).toBeNull()
      expect(out.value.capacity_hint).toBeNull()
    }
  })

  it('rejects non-object top-level payload', () => {
    const out = validateVenueMetadataPayload('not-an-object')
    expect(out.ok).toBe(false)
  })
})

describe('updateVenueMetadata HTTP contract', () => {
  interface MockCall {
    url: string
    init: RequestInit
  }

  let calls: MockCall[] = []
  let nextResponse: { status: number; body: unknown } = {
    status: 200,
    body: { data: { id: 'venue_1' } },
  }

  beforeEach(() => {
    calls = []
    nextResponse = { status: 200, body: { data: { id: 'venue_1' } } }
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

  it('POSTs to /api/admin/venue-metadata with bearer + validated body', async () => {
    await updateVenueMetadata('venue_1', {
      dress_code: 'upscale',
      cover_charge_cents: 2500,
      accessibility_features: ['wheelchair_accessible'],
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/admin/venue-metadata')
    expect(calls[0].init.method).toBe('POST')
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get('Authorization')).toBe('Bearer admin-token')
    expect(headers.get('Content-Type')).toBe('application/json')
    const parsed = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>
    expect(parsed.venue_id).toBe('venue_1')
    expect(parsed.dress_code).toBe('upscale')
    expect(parsed.cover_charge_cents).toBe(2500)
  })

  it('throws before fetching when payload is invalid', async () => {
    await expect(
      updateVenueMetadata('venue_1', { cover_charge_cents: -1 }),
    ).rejects.toThrow(/cover_charge_cents/)
    expect(calls).toHaveLength(0)
  })

  it('throws when venueId is empty', async () => {
    await expect(updateVenueMetadata('', { dress_code: 'casual' })).rejects.toThrow(
      /venueId/,
    )
    expect(calls).toHaveLength(0)
  })

  it('bubbles up structured server error messages', async () => {
    nextResponse = {
      status: 403,
      body: { error: { code: 'forbidden', message: 'Admin role required' } },
    }
    await expect(
      updateVenueMetadata('venue_1', { dress_code: 'casual' }),
    ).rejects.toThrow(/Admin role required/)
  })

  it('handles string-form error bodies', async () => {
    nextResponse = { status: 400, body: { error: 'nope' } }
    await expect(
      updateVenueMetadata('venue_1', { dress_code: 'casual' }),
    ).rejects.toThrow(/nope/)
  })

  it('throws a clear message when no session is present', async () => {
    const mod = await import('@/lib/supabase')
    ;(mod.supabase.auth.getSession as unknown) = async () => ({
      data: { session: null },
    })
    await expect(
      updateVenueMetadata('venue_1', { dress_code: 'casual' }),
    ).rejects.toThrow(/Not authenticated/)
    // restore for any later cases
    ;(mod.supabase.auth.getSession as unknown) = async () => ({
      data: { session: { access_token: 'admin-token' } },
    })
  })
})
