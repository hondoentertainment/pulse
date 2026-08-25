import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestLike, ResponseLike } from '../../_lib/http'

const upsert = vi.fn()
const createUserClient = vi.fn(() => ({
  from: () => ({ upsert }),
}))

vi.mock('../../_lib/supabase-server', () => ({
  createUserClient: (...args: unknown[]) => createUserClient(...args),
}))

import handler from '../push-subscribe'

function makeResponse() {
  const state: { status: number; body: unknown } = { status: 0, body: undefined }
  const res: ResponseLike = {
    status(code: number) {
      state.status = code
      return res
    },
    setHeader() {},
    json(payload: unknown) {
      state.body = payload
    },
    end() {},
  }
  return { res, state }
}

function makeRequest(headers: Record<string, string> = {}, body: unknown = {
  endpoint: 'https://push.example/sub',
  keys: { p256dh: 'p', auth: 'a' },
}): RequestLike {
  return {
    method: 'POST',
    body,
    headers: {
      origin: 'https://app.test',
      ...headers,
    },
  }
}

describe('POST /api/signal/push-subscribe', () => {
  const previousUrl = process.env.SUPABASE_URL
  const previousAnon = process.env.SUPABASE_ANON_KEY

  beforeEach(() => {
    upsert.mockReset()
    createUserClient.mockClear()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon'
    upsert.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = previousUrl
    if (previousAnon === undefined) delete process.env.SUPABASE_ANON_KEY
    else process.env.SUPABASE_ANON_KEY = previousAnon
    vi.unstubAllGlobals()
  })

  it('rejects a forged JWT before writing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })))
    const { res, state } = makeResponse()
    await handler(makeRequest({ authorization: 'Bearer forged.jwt.token' }), res)
    expect(state.status).toBe(401)
    expect(createUserClient).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('writes through the user-scoped client after Supabase verifies the JWT', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'user-123',
      email: 'a@example.com',
    }), { status: 200 })))
    const { res, state } = makeResponse()
    await handler(makeRequest({ authorization: 'Bearer real.jwt.token' }), res)
    expect(state.status).toBe(200)
    expect(createUserClient).toHaveBeenCalledWith('real.jwt.token')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        endpoint: 'https://push.example/sub',
      }),
      { onConflict: 'endpoint' },
    )
  })
})
