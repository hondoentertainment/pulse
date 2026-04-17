import { describe, expect, it, vi } from 'vitest'

import {
  confirmContactVerificationCode,
  endSafetySession,
  pingSafetySession,
  sendContactVerificationCode,
  startSafetySession,
  triggerSafetyPanic,
} from '../safety-client'

function makeFetchMock(response: {
  ok?: boolean
  status?: number
  body?: unknown
}): {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  calls: Array<{ url: string; init?: RequestInit }>
} {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.body ?? {},
      text: async () => JSON.stringify(response.body ?? {}),
    } as unknown as Response
  })
  return { fetch: fn as unknown as (url: string, init?: RequestInit) => Promise<Response>, calls }
}

describe('safety-client', () => {
  it('startSafetySession posts to /api/safety/session/start', async () => {
    const mock = makeFetchMock({ body: { data: { id: 's1' } } })
    const result = await startSafetySession(
      {
        kind: 'safe_walk',
        expectedDurationMinutes: 15,
        contacts: [],
      },
      { fetch: mock.fetch },
    )
    expect(result.ok).toBe(true)
    expect(mock.calls[0].url).toBe('/api/safety/session/start')
    const body = JSON.parse((mock.calls[0].init?.body as string) ?? '{}') as {
      kind: string
      expectedDurationMinutes: number
    }
    expect(body.kind).toBe('safe_walk')
    expect(body.expectedDurationMinutes).toBe(15)
  })

  it('pingSafetySession posts to the ping endpoint', async () => {
    const mock = makeFetchMock({ body: { data: { ok: true } } })
    const result = await pingSafetySession(
      { sessionId: 's1', lat: 40, lng: -70 },
      { fetch: mock.fetch },
    )
    expect(result.ok).toBe(true)
    expect(mock.calls[0].url).toBe('/api/safety/session/ping')
  })

  it('endSafetySession posts to the end endpoint', async () => {
    const mock = makeFetchMock({ body: { data: { id: 's1', state: 'completed' } } })
    const result = await endSafetySession({ sessionId: 's1' }, { fetch: mock.fetch })
    expect(result.ok).toBe(true)
    expect(mock.calls[0].url).toBe('/api/safety/session/end')
  })

  it('triggerSafetyPanic surfaces 4xx errors cleanly', async () => {
    const mock = makeFetchMock({ ok: false, status: 401, body: { error: 'unauthorized' } })
    const result = await triggerSafetyPanic({ kind: 'panic' }, { fetch: mock.fetch })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('unauthorized')
      expect(result.status).toBe(401)
    }
  })

  it('sendContactVerificationCode + confirm are wired', async () => {
    const sendMock = makeFetchMock({ body: { data: { ok: true, expiresAt: 'later' } } })
    const confirmMock = makeFetchMock({ body: { data: { ok: true, verifiedAt: 'now' } } })
    const send = await sendContactVerificationCode({ contactId: 'c1' }, { fetch: sendMock.fetch })
    expect(send.ok).toBe(true)
    const confirm = await confirmContactVerificationCode(
      { contactId: 'c1', code: '123456' },
      { fetch: confirmMock.fetch },
    )
    expect(confirm.ok).toBe(true)
  })
})
