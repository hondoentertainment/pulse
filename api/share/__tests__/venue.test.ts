import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestLike, ResponseLike } from '../../_lib/http'

const { loadShareOgEnergyMock, loadShareNeighborhoodOgMock, loadShareVenueCoverUrlMock } = vi.hoisted(() => ({
  loadShareOgEnergyMock: vi.fn(),
  loadShareNeighborhoodOgMock: vi.fn(),
  loadShareVenueCoverUrlMock: vi.fn(),
}))

vi.mock('../../_lib/share-og-lookup.js', () => ({
  loadShareOgEnergy: (...args: unknown[]) => loadShareOgEnergyMock(...args),
  loadShareNeighborhoodOg: (...args: unknown[]) => loadShareNeighborhoodOgMock(...args),
  loadShareVenueCoverUrl: (...args: unknown[]) => loadShareVenueCoverUrlMock(...args),
}))
vi.mock('../../_lib/share-og-lookup.ts', () => ({
  loadShareOgEnergy: (...args: unknown[]) => loadShareOgEnergyMock(...args),
  loadShareNeighborhoodOg: (...args: unknown[]) => loadShareNeighborhoodOgMock(...args),
  loadShareVenueCoverUrl: (...args: unknown[]) => loadShareVenueCoverUrlMock(...args),
}))
vi.mock('../../_lib/share-og-lookup', () => ({
  loadShareOgEnergy: (...args: unknown[]) => loadShareOgEnergyMock(...args),
  loadShareNeighborhoodOg: (...args: unknown[]) => loadShareNeighborhoodOgMock(...args),
  loadShareVenueCoverUrl: (...args: unknown[]) => loadShareVenueCoverUrlMock(...args),
}))

import handler from '../venue'

const NEUMOS_ID = 'a0000000-0000-4000-8000-000000000018'

function makeResponse() {
  const state: { status: number; body: string; headers: Record<string, string> } = {
    status: 0,
    body: '',
    headers: {},
  }
  const res = {
    status(code: number) {
      state.status = code
      return res
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value
    },
    json() {},
    end(body?: string) {
      if (body !== undefined) state.body = body
    },
    send(body: string) {
      state.body = body
    },
  }
  return { res: res as ResponseLike, state }
}

describe('GET /api/share/venue', () => {
  beforeEach(() => {
    loadShareOgEnergyMock.mockReset()
    loadShareNeighborhoodOgMock.mockReset()
    loadShareVenueCoverUrlMock.mockReset()
    loadShareVenueCoverUrlMock.mockResolvedValue(null)
  })

  it('sets og:title to Neumos when the venue fetch returns', async () => {
    loadShareOgEnergyMock.mockResolvedValue({
      title: 'Neumos',
      description: 'Electric · 12m ago · Music Venue · Capitol Hill, Seattle',
      energyLine: 'Electric · 12m ago',
      freshness: '12m ago',
    })

    const { res, state } = makeResponse()
    await handler(
      {
        method: 'GET',
        query: { venueId: NEUMOS_ID },
        headers: { host: 'pulse-chi-nine.vercel.app', 'x-forwarded-proto': 'https' },
      } as RequestLike,
      res,
    )

    expect(state.status).toBe(200)
    expect(state.headers['content-type']).toContain('text/html')
    expect(state.body).toContain('content="Neumos"')
    expect(state.body).toContain(`<title>Neumos</title>`)
    expect(state.body).toContain(`/venue/${NEUMOS_ID}?from=share`)
    expect(state.body).toContain(`/api/share/og?venueId=${NEUMOS_ID}`)
    expect(state.body).not.toContain('Venue on Pulse')
  })

  it('keeps the generic crawler card when lookup fails', async () => {
    loadShareOgEnergyMock.mockRejectedValue(new Error('network'))
    const { res, state } = makeResponse()
    await handler(
      {
        method: 'GET',
        query: { venueId: NEUMOS_ID },
        headers: { host: 'pulse-chi-nine.vercel.app' },
      } as RequestLike,
      res,
    )
    expect(state.body).toContain('og:title" content="Venue on Pulse"')
    expect(state.body).toContain(`/venue/${NEUMOS_ID}?from=share`)
  })

  it('sets a real neighborhood card when a group chat drops /n/capitol-hill', async () => {
    loadShareNeighborhoodOgMock.mockResolvedValue({
      title: 'Capitol Hill',
      description: 'Tonight · Seattle · tagged rooms in Capitol Hill. We never invent a crowd.',
      energyLine: 'Tonight · Seattle',
    })

    const { res, state } = makeResponse()
    await handler(
      {
        method: 'GET',
        query: { n: 'capitol-hill' },
        headers: { host: 'pulse-chi-nine.vercel.app', 'x-forwarded-proto': 'https' },
      } as RequestLike,
      res,
    )

    expect(state.status).toBe(200)
    expect(state.body).toContain('content="Capitol Hill"')
    expect(state.body).toContain('<title>Capitol Hill</title>')
    expect(state.body).toContain('/n/capitol-hill')
    expect(state.body).toContain('/api/share/og?n=capitol-hill')
    expect(state.body).not.toContain('/venue/')
    expect(loadShareOgEnergyMock).not.toHaveBeenCalled()
  })
})
