/**
 * Admin authorization tests for privileged endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ResponseLike } from '../http'
import * as authModule from '../auth'

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

describe('admin API authorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /api/push/test forbids non-admins from targeting another user', async () => {
    vi.spyOn(authModule, 'verifySupabaseJwt').mockResolvedValue({
      ok: true,
      user: { id: 'user-a', email: 'a@example.com', isAdmin: false },
    })

    const { default: handler } = await import('../../push/test')
    const { res, state } = makeResponse()
    await handler(
      {
        method: 'POST',
        body: { userId: 'user-b' },
        headers: { authorization: 'Bearer test-token' },
      },
      res,
    )

    expect(state.status).toBe(403)
  })

  it('POST /api/keys/generate forbids non-admin authenticated users', async () => {
    vi.spyOn(authModule, 'verifySupabaseJwt').mockResolvedValue({
      ok: true,
      user: { id: 'user-a', email: 'a@example.com', isAdmin: false },
    })

    const { default: handler } = await import('../../keys/generate')
    const { res, state } = makeResponse()
    await handler(
      {
        method: 'POST',
        body: { name: 'test', ownerId: 'owner-1' },
        headers: { authorization: 'Bearer test-token' },
      },
      res,
    )

    expect(state.status).toBe(403)
  })

  it('POST /api/keys/generate allows admin users', async () => {
    vi.spyOn(authModule, 'verifySupabaseJwt').mockResolvedValue({
      ok: true,
      user: { id: 'admin-1', email: 'admin@example.com', isAdmin: true },
    })

    const { default: handler } = await import('../../keys/generate')
    const { res, state } = makeResponse()
    await handler(
      {
        method: 'POST',
        body: { name: 'staging-key', ownerId: 'owner-1', tier: 'free' },
        headers: { authorization: 'Bearer admin-token' },
      },
      res,
    )

    expect(state.status).toBe(201)
    expect(state.body).toMatchObject({
      data: expect.objectContaining({ name: 'staging-key', ownerId: 'owner-1' }),
    })
  })
})
