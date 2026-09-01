import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
const authState = vi.hoisted(() => ({
  ok: true as boolean,
  error: undefined as string | undefined,
  user: { id: 'user-1' } as { id: string } | undefined,
}))

vi.mock('../../_lib/supabase-server.js', () => ({
  createUserClient: (...args: unknown[]) => createUserClient(...args),
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}))
vi.mock('../../_lib/supabase-server.ts', () => ({
  createUserClient: (...args: unknown[]) => createUserClient(...args),
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}))
vi.mock('../../_lib/supabase-server', () => ({
  createUserClient: (...args: unknown[]) => createUserClient(...args),
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}))
vi.mock('../../_lib/auth.js', () => ({
  extractBearer: () => (authState.ok ? 'jwt-token' : null),
  verifySupabaseJwt: async () => ({
    ok: authState.ok,
    user: authState.user,
    error: authState.error,
  }),
}))
vi.mock('../../_lib/auth.ts', () => ({
  extractBearer: () => (authState.ok ? 'jwt-token' : null),
  verifySupabaseJwt: async () => ({
    ok: authState.ok,
    user: authState.user,
    error: authState.error,
  }),
}))
vi.mock('../../_lib/auth', () => ({
  extractBearer: () => (authState.ok ? 'jwt-token' : null),
  verifySupabaseJwt: async () => ({
    ok: authState.ok,
    user: authState.user,
    error: authState.error,
  }),
}))

import handler from '../account-delete'

const accountDeleteSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../account-delete.ts'),
  'utf8',
)

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
    authState.ok = true
    authState.user = { id: 'user-1' }
    authState.error = undefined
  })

  it('uses explicit .js/.ts relative specifiers (Vercel ESM)', () => {
    const withoutComments = accountDeleteSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const relativeSpecifiers = [...withoutComments.matchAll(/from\s+['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)]
      .map((match) => match[1] ?? match[2])
    expect(relativeSpecifiers.length).toBeGreaterThan(0)
    expect(relativeSpecifiers.every((specifier) => specifier.endsWith('.js') || specifier.endsWith('.ts'))).toBe(true)
  })

  it('returns 401 without crashing when auth fails', async () => {
    authState.ok = false
    authState.user = undefined
    authState.error = 'Missing Bearer token'
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { confirm: 'DELETE' } } as RequestLike, res)
    expect(state.status).toBe(401)
    expect(createUserClient).not.toHaveBeenCalled()
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
