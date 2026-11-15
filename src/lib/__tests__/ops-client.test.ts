import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'admin-token' } },
      }),
    },
  },
}))

import { isAdminSession, listOpsClaims, listVenueReportsOnServer } from '../ops-client'

describe('ops admin gate', () => {
  it('requires app_metadata.role admin', () => {
    expect(isAdminSession(null)).toBe(false)
    expect(isAdminSession({ user: { app_metadata: { role: 'user' } } })).toBe(false)
    expect(isAdminSession({ user: { app_metadata: { role: 'admin' } } })).toBe(true)
  })

  it('does not treat a regular JWT role as admin without app_metadata', () => {
    expect(isAdminSession({ user: { role: 'authenticated' } })).toBe(false)
  })
})

describe('ops queue redaction', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drops claim evidence, notes, user ids, and work emails before the page sees them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          claims: [{
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
            venue_name: 'Neumos',
            neighborhood: 'Capitol Hill',
            venues: { owner_email_domain: 'neumos.com' },
          }],
        },
      }),
    })))

    const claims = await listOpsClaims('pending')
    expect(claims).toEqual([{
      id: 'c1',
      venue_id: 'v1',
      status: 'pending',
      created_at: '2026-09-12T01:00:00.000Z',
      venue_name: 'Neumos',
      neighborhood: 'Capitol Hill',
    }])
    const json = JSON.stringify(claims)
    for (const secret of ['user-9', 'I own the lease', 'call the gm', 'gm@neumos.com', 'neumos.com', 'user_id', 'evidence', 'notes', 'work_email']) {
      expect(json).not.toContain(secret)
    }
  })

  it('does not return who filed a venue report', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          reports: [{
            id: 'r1',
            pulse_id: 'p1',
            reporter_id: 'reporter-secret',
            reason: 'spam',
            details: 'bots',
            created_at: '2026-09-12T01:00:00.000Z',
            status: 'pending',
            reviewed_at: null,
          }],
        },
      }),
    })))

    const reports = await listVenueReportsOnServer('neumos')
    expect(reports).toEqual([{
      id: 'r1',
      pulse_id: 'p1',
      reason: 'spam',
      details: 'bots',
      created_at: '2026-09-12T01:00:00.000Z',
      status: 'pending',
      reviewed_at: null,
    }])
    const json = JSON.stringify(reports)
    expect(json).not.toContain('reporter-secret')
    expect(json).not.toContain('reporter_id')
  })
})
