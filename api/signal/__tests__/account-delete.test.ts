import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestLike, ResponseLike } from '../../_lib/http'

const deleteEq = vi.fn()
const createUserClient = vi.fn(() => ({
  from: () => ({
    delete: () => ({
      eq: deleteEq,
    }),
  }),
}))
const deleteUser = vi.fn()
const createAdminClient = vi.fn(() => ({
  auth: { admin: { deleteUser } },
}))

vi.mock('../../_lib/supabase-server', () => ({
  createUserClient: (...args: unknown[]) => createUserClient(...args),
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}))

vi.mock('../../_lib/auth', () => ({
  extractBearer: () => 'jwt-token',
  verifySupabaseJwt: async () => ({ ok: true, user: { id: 'user-1' } }),
}))

import handler from '../account-delete'

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

describe('POST /api/signal/account-delete', () => {
  beforeEach(() => {
    deleteEq.mockReset().mockResolvedValue({ error: null })
    deleteUser.mockReset().mockResolvedValue({ error: null })
    createAdminClient.mockClear()
    createUserClient.mockClear()
  })

  it('rejects without DELETE confirmation', async () => {
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: {} } as RequestLike, res)
    expect(state.status).toBe(400)
  })

  it('deletes Signal rows and the auth user when admin is available', async () => {
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { confirm: 'DELETE' } } as RequestLike, res)
    expect(deleteEq).toHaveBeenCalledTimes(3)
    expect(deleteUser).toHaveBeenCalledWith('user-1')
    expect(state.status).toBe(200)
    expect(state.body).toEqual({ data: { deleted: true, authDeleted: true } })
  })
})
