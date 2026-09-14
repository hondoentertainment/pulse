import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestLike, ResponseLike } from '../../_lib/http'

const { loadShareOgEnergyMock, loadShareNeighborhoodOgMock } = vi.hoisted(() => ({
  loadShareOgEnergyMock: vi.fn(),
  loadShareNeighborhoodOgMock: vi.fn(),
}))

vi.mock('../../_lib/share-og-lookup.js', () => ({
  loadShareOgEnergy: (...args: unknown[]) => loadShareOgEnergyMock(...args),
  loadShareNeighborhoodOg: (...args: unknown[]) => loadShareNeighborhoodOgMock(...args),
}))
vi.mock('../../_lib/share-og-lookup.ts', () => ({
  loadShareOgEnergy: (...args: unknown[]) => loadShareOgEnergyMock(...args),
  loadShareNeighborhoodOg: (...args: unknown[]) => loadShareNeighborhoodOgMock(...args),
}))
vi.mock('../../_lib/share-og-lookup', () => ({
  loadShareOgEnergy: (...args: unknown[]) => loadShareOgEnergyMock(...args),
  loadShareNeighborhoodOg: (...args: unknown[]) => loadShareNeighborhoodOgMock(...args),
}))

import handler from '../og'

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

describe('GET /api/share/og', () => {
  beforeEach(() => {
    loadShareOgEnergyMock.mockReset()
    loadShareNeighborhoodOgMock.mockReset()
  })

  it('renders the SVG title as Neumos when the venue fetch returns', async () => {
    loadShareOgEnergyMock.mockResolvedValue({
      title: 'Neumos',
      description: 'Electric · 12m ago · Music Venue · Capitol Hill, Seattle',
      energyLine: 'Electric · 12m ago',
      freshness: '12m ago',
    })

    const { res, state } = makeResponse()
    await handler(
      { method: 'GET', query: { venueId: NEUMOS_ID } } as RequestLike,
      res,
    )

    expect(state.status).toBe(200)
    expect(state.headers['content-type']).toContain('image/svg+xml')
    expect(state.body).toContain('>Neumos<')
    expect(state.body).toContain('Electric · 12m ago')
    expect(state.body).not.toContain('>Pulse<')
  })

  it('keeps the generic SVG card when lookup fails', async () => {
    loadShareOgEnergyMock.mockRejectedValue(new Error('network'))
    const { res, state } = makeResponse()
    await handler(
      { method: 'GET', query: { venueId: NEUMOS_ID } } as RequestLike,
      res,
    )
    expect(state.body).toContain('>Pulse<')
    expect(state.body).toContain('Live reviews on Pulse')
  })

  it('renders a neighborhood SVG card for /n/capitol-hill', async () => {
    loadShareNeighborhoodOgMock.mockResolvedValue({
      title: 'Capitol Hill',
      description: 'Tonight · Seattle · tagged rooms in Capitol Hill. We never invent a crowd.',
      energyLine: 'Tonight · Seattle',
    })

    const { res, state } = makeResponse()
    await handler(
      { method: 'GET', query: { n: 'capitol-hill' } } as RequestLike,
      res,
    )

    expect(state.status).toBe(200)
    expect(state.headers['content-type']).toContain('image/svg+xml')
    expect(state.body).toContain('>Capitol Hill<')
    expect(state.body).toContain('Tonight · Seattle')
    expect(state.body).toContain('Someone shared a neighborhood')
    expect(state.body).not.toContain('>Pulse<')
    expect(loadShareOgEnergyMock).not.toHaveBeenCalled()
  })
})
