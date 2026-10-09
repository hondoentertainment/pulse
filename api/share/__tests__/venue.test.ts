import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestLike, ResponseLike } from '../../_lib/http'

const { loadShareOgEnergyMock, loadShareNeighborhoodOgMock, hopNameMock } = vi.hoisted(() => ({
  loadShareOgEnergyMock: vi.fn(),
  loadShareNeighborhoodOgMock: vi.fn(),
  hopNameMock: vi.fn(async () => null as string | null),
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
vi.mock('../../_lib/hop-heading-lookup.js', () => ({
  loadHopHeadingName: (...args: unknown[]) => hopNameMock(...args),
}))
vi.mock('../../_lib/hop-heading-lookup.ts', () => ({
  loadHopHeadingName: (...args: unknown[]) => hopNameMock(...args),
}))
vi.mock('../../_lib/hop-heading-lookup', () => ({
  loadHopHeadingName: (...args: unknown[]) => hopNameMock(...args),
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
    hopNameMock.mockReset()
    hopNameMock.mockResolvedValue(null)
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
    expect(state.body).toContain('property="og:title" content="Neumos"')
    expect(state.body).toContain('property="og:description" content="Electric · 12m ago · Music Venue · Capitol Hill, Seattle"')
    expect(state.body).toContain(`<title>Neumos</title>`)
    expect(state.body).toContain(`/venue/${NEUMOS_ID}?from=share#energy`)
    expect(state.body).toContain(`/api/share/og?venueId=${NEUMOS_ID}`)
    expect(state.body).toContain('property="og:image:type" content="image/png"')
    expect(state.body).toContain('property="og:image:alt" content="Electric · 12m ago"')
    expect(state.body).toContain('name="twitter:title" content="Neumos"')
    expect(state.body).toContain('name="twitter:description" content="Electric · 12m ago · Music Venue · Capitol Hill, Seattle"')
    expect(state.body).toContain(`property="og:url" content="https://pulse-chi-nine.vercel.app/api/share/venue?venueId=${NEUMOS_ID}"`)
    expect(state.body).not.toContain('http-equiv="refresh"')
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
    expect(state.status).toBe(200)
    expect(state.headers['content-type']).toContain('text/html')
    expect(state.body).toContain('og:title" content="Venue on Pulse"')
    expect(state.body).toContain('property="og:description"')
    expect(state.body).toContain(`/venue/${NEUMOS_ID}?from=share#energy`)
    expect(state.body).not.toContain('http-equiv="refresh"')
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

  it('lands hop shares on /venue/:id?hop=1 and names who is heading there', async () => {
    loadShareOgEnergyMock.mockResolvedValue({
      title: 'The Chapel',
      description: 'Buzzing',
      energyLine: 'Buzzing',
    })
    hopNameMock.mockImplementation(async (_venueId: unknown, headingId?: string | null) => (
      headingId === 'heading-kyle' ? 'Kyle' : null
    ))
    const { res, state } = makeResponse()
    await handler(
      {
        method: 'GET',
        query: { venueId: 'sf-chapel', hop: '1', h: 'heading-kyle' },
        headers: { host: 'pulse-chi-nine.vercel.app', 'x-forwarded-proto': 'https' },
      } as RequestLike,
      res,
    )
    expect(state.status).toBe(200)
    expect(hopNameMock).toHaveBeenCalledWith('sf-chapel', 'heading-kyle')
    expect(state.body).toContain('content="Kyle is heading to The Chapel"')
    expect(state.body).toContain('/venue/sf-chapel?hop=1&h=heading-kyle')
    expect(state.body).toContain('property="og:url" content="https://pulse-chi-nine.vercel.app/api/share/venue?venueId=sf-chapel&amp;hop=1&amp;h=heading-kyle"')
    expect(state.body).not.toContain('from=share')
  })
})
