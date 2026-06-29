/**
 * Auth guard tests for write endpoints.
 *
 * Verifies that unauthenticated requests are rejected before any side effects
 * (Supabase, push providers, etc.) are attempted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ResponseLike } from '../http'

function makeResponse() {
  const state: { status: number; body: unknown; headers: Record<string, string> } = {
    status: 0,
    body: undefined,
    headers: {},
  }
  const res: ResponseLike = {
    status(code: number) {
      state.status = code
      return res
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value
    },
    json(payload: unknown) {
      state.body = payload
    },
    end() {
      /* no-op */
    },
  }
  return { res, state }
}

describe('write API auth guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /api/pulses/create rejects missing Authorization', async () => {
    const { default: handler } = await import('../../pulses/create')
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: {}, headers: {} }, res)
    expect(state.status).toBe(401)
    expect(state.body).toMatchObject({ error: { code: 'unauthenticated' } })
  })

  it('POST /api/push/register rejects missing Authorization', async () => {
    const { default: handler } = await import('../../push/register')
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { token: 't', platform: 'ios' }, headers: {} }, res)
    expect(state.status).toBe(401)
    expect(state.body).toMatchObject({ error: 'Unauthorized' })
  })

  it('POST /api/push/unregister rejects missing Authorization', async () => {
    const { default: handler } = await import('../../push/unregister')
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { token: 't' }, headers: {} }, res)
    expect(state.status).toBe(401)
    expect(state.body).toMatchObject({ error: 'Unauthorized' })
  })

  it('POST /api/push/test rejects missing Authorization', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { default: handler } = await import('../../push/test')
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: {}, headers: {} }, res)
    expect(state.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POST /api/account/delete rejects missing Authorization', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { default: handler } = await import('../../account/delete')
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { confirm: 'DELETE' }, headers: {} }, res)
    expect(state.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('GET /api/account/export rejects missing Authorization', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { default: handler } = await import('../../account/export')
    const { res, state } = makeResponse()
    await handler({ method: 'GET', headers: {} }, res)
    expect(state.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POST /api/moderation/check rejects missing Authorization', async () => {
    const { default: handler } = await import('../../moderation/check')
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { content: 'hi', kind: 'pulse' }, headers: {} }, res)
    expect(state.status).toBe(401)
    expect(state.body).toMatchObject({ error: { code: 'unauthenticated' } })
  })

  it('GET /api/account/notification-settings rejects missing Authorization', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { default: handler } = await import('../../account/notification-settings')
    const { res, state } = makeResponse()
    await handler({ method: 'GET', headers: {} }, res)
    expect(state.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POST /api/safety/session/start rejects missing Authorization', async () => {
    const { default: handler } = await import('../../safety/session/start')
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { kind: 'safe_walk' }, headers: {} }, res)
    expect(state.status).toBe(401)
    expect(state.body).toMatchObject({ error: 'unauthorized' })
  })

  it('POST /api/ticketing/purchase rejects missing Authorization', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { default: handler } = await import('../../ticketing/purchase')
    const { res, state } = makeResponse()
    await handler(
      { method: 'POST', body: { eventId: '00000000-0000-4000-8000-000000000099', quantity: 1 }, headers: {} },
      res,
    )
    expect(state.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
