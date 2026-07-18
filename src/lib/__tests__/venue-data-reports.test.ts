import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizeProposedFields,
  summarizeVenueHours,
  submitVenueDataReport,
} from '../venue-data-reports'

describe('normalizeProposedFields', () => {
  it('keeps supported correction fields', () => {
    const result = normalizeProposedFields({
      address: ' 123 Pike St ',
      phone: '206-555-0100',
    })
    expect(result).toEqual({
      ok: true,
      value: { address: '123 Pike St', phone: '206-555-0100' },
    })
  })

  it('rejects unknown keys', () => {
    const result = normalizeProposedFields({ cover: '10' })
    expect(result.ok).toBe(false)
  })
})

describe('summarizeVenueHours', () => {
  it('joins listed days', () => {
    expect(
      summarizeVenueHours({
        friday: '5pm-2am',
        saturday: '5pm-2am',
      }),
    ).toBe('fri 5pm-2am · sat 5pm-2am')
  })

  it('returns undefined for empty hours', () => {
    expect(summarizeVenueHours({})).toBeUndefined()
    expect(summarizeVenueHours(undefined)).toBeUndefined()
  })
})

describe('submitVenueDataReport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requires a Pulse access token', async () => {
    const result = await submitVenueDataReport({
      venueId: 'venue-1',
      reason: 'wrong_address',
    })
    expect(result).toEqual({
      ok: false,
      error: 'Sign in with your Pulse account to suggest a correction.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('posts proposed fields when authenticated', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'r1',
          venue_id: 'venue-1',
          user_id: 'user-1',
          reason: 'wrong_address',
          proposed_fields: { address: '100 Pine St' },
          status: 'pending',
          created_at: '2026-07-16T00:00:00.000Z',
        },
      }),
    } as Response)

    const result = await submitVenueDataReport({
      venueId: 'venue-1',
      reason: 'wrong_address',
      proposedFields: { address: '100 Pine St' },
      accessToken: 'token',
    })

    expect(result.ok).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      '/api/venues/data-report',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    )
    if (result.ok) {
      expect(result.report.proposedFields).toEqual({ address: '100 Pine St' })
    }
  })

  it('surfaces auth failures instead of faking success', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    } as Response)

    const result = await submitVenueDataReport({
      venueId: 'venue-1',
      reason: 'other',
      accessToken: 'stale',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Sign in|Unauthorized/i)
    }
  })
})
