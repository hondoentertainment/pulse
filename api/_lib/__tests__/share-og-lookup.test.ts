import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShareCatalogClient } from '../share-og-lookup'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createAnonClient: vi.fn(),
}))

vi.mock('../supabase-server.js', () => ({
  createAdminClient: () => mocks.createAdminClient(),
  createAnonClient: () => mocks.createAnonClient(),
}))
vi.mock('../supabase-server.ts', () => ({
  createAdminClient: () => mocks.createAdminClient(),
  createAnonClient: () => mocks.createAnonClient(),
}))
vi.mock('../supabase-server', () => ({
  createAdminClient: () => mocks.createAdminClient(),
  createAnonClient: () => mocks.createAnonClient(),
}))

import { loadShareOgEnergy, resolveShareCatalogClient } from '../share-og-lookup'

const NEUMOS_ID = 'a0000000-0000-4000-8000-000000000018'

function stubCatalogClient(opts: {
  venue?: Record<string, unknown> | null
  pulse?: Record<string, unknown> | null
}): ShareCatalogClient {
  return {
    from(table: string) {
      const row = table === 'venues' ? (opts.venue ?? null) : (opts.pulse ?? null)
      const chain = {
        select() {
          return chain
        },
        eq() {
          return chain
        },
        order() {
          return chain
        },
        limit() {
          return chain
        },
        maybeSingle: async () => ({ data: row, error: null }),
      }
      return chain
    },
  } as ShareCatalogClient
}

describe('share OG catalog lookup', () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset()
    mocks.createAnonClient.mockReset()
  })

  it('uses the anon/public client when the service-role admin client is null', () => {
    const anon = stubCatalogClient({})
    mocks.createAdminClient.mockReturnValue(null)
    mocks.createAnonClient.mockReturnValue(anon)
    expect(resolveShareCatalogClient()).toBe(anon)
    expect(mocks.createAnonClient).toHaveBeenCalledOnce()
  })

  it('sets the OG title to Neumos when the venue fetch returns', async () => {
    const now = Date.parse('2026-09-11T02:00:00.000Z')
    const client = stubCatalogClient({
      venue: {
        name: 'Neumos',
        neighborhood: 'Capitol Hill',
        city: 'Seattle',
        category: 'Music Venue',
        pulse_score: 20,
      },
      pulse: {
        energy_rating: 'electric',
        created_at: new Date(now - 12 * 60 * 1000).toISOString(),
      },
    })

    mocks.createAdminClient.mockReturnValue(null)
    mocks.createAnonClient.mockReturnValue(client)

    const card = await loadShareOgEnergy(NEUMOS_ID, { nowMs: now })
    expect(card?.title).toBe('Neumos')
    expect(card?.energyLine).toBe('Electric · 12m ago')
    expect(mocks.createAdminClient).toHaveBeenCalled()
    expect(mocks.createAnonClient).toHaveBeenCalled()
  })

  it('returns null when the venue row is missing', async () => {
    const card = await loadShareOgEnergy(NEUMOS_ID, {
      client: stubCatalogClient({ venue: null, pulse: null }),
    })
    expect(card).toBeNull()
  })
})
