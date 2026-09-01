import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestLike, ResponseLike } from '../../_lib/http'

const mocks = vi.hoisted(() => ({
  loaded: { supabaseServer: false, auth: false },
  createAdminClient: vi.fn(),
  getAuthenticatedUserId: vi.fn(() => null as string | null),
}))

vi.mock('../../_lib/supabase-server.js', () => {
  mocks.loaded.supabaseServer = true
  return { createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args) }
})
vi.mock('../../_lib/supabase-server.ts', () => {
  mocks.loaded.supabaseServer = true
  return { createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args) }
})
vi.mock('../../_lib/supabase-server', () => {
  mocks.loaded.supabaseServer = true
  return { createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args) }
})
vi.mock('../../_lib/auth.js', () => {
  mocks.loaded.auth = true
  return {
    getAuthenticatedUserId: (...args: unknown[]) => mocks.getAuthenticatedUserId(...args),
  }
})
vi.mock('../../_lib/auth.ts', () => {
  mocks.loaded.auth = true
  return {
    getAuthenticatedUserId: (...args: unknown[]) => mocks.getAuthenticatedUserId(...args),
  }
})
vi.mock('../../_lib/auth', () => {
  mocks.loaded.auth = true
  return {
    getAuthenticatedUserId: (...args: unknown[]) => mocks.getAuthenticatedUserId(...args),
  }
})

import handler from '../pilot'

const pilotSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../pilot.ts'),
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

describe('POST /api/signal/pilot', () => {
  beforeEach(() => {
    mocks.loaded.supabaseServer = false
    mocks.loaded.auth = false
    mocks.createAdminClient.mockReset()
    mocks.getAuthenticatedUserId.mockReset().mockReturnValue(null)
  })

  it('uses explicit .js/.ts relative specifiers (Vercel ESM)', () => {
    const withoutComments = pilotSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const relativeSpecifiers = [...withoutComments.matchAll(/from\s+['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)]
      .map((match) => match[1] ?? match[2])
    expect(relativeSpecifiers.length).toBeGreaterThan(0)
    expect(relativeSpecifiers.every((specifier) => specifier.endsWith('.js') || specifier.endsWith('.ts'))).toBe(true)
    expect(relativeSpecifiers.some((specifier) => specifier.includes('supabase-server.js'))).toBe(true)
    expect(relativeSpecifiers.some((specifier) => specifier.includes('signal-pilot.js'))).toBe(true)
  })

  it('boots and rejects an invalid email without crashing', async () => {
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { email: 'not-an-email' } } as RequestLike, res)
    expect(state.status).toBe(400)
    expect(state.body).toEqual({ error: 'Enter a valid email address.' })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('returns 500 when supabase is unconfigured (boot path, not FUNCTION_INVOCATION_FAILED)', async () => {
    mocks.createAdminClient.mockReturnValue(null)
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { email: 'ada@pulse.app' } } as RequestLike, res)
    expect(state.status).toBe(500)
    expect(state.body).toEqual({ error: 'Pilot list is not configured on the server.' })
  })

  it('inserts one row on first submit', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.createAdminClient.mockReturnValue({
      from: () => ({ insert }),
    })
    mocks.getAuthenticatedUserId.mockReturnValue('user-1')
    const { res, state } = makeResponse()
    await handler({
      method: 'POST',
      body: { email: ' Ada@Pulse.app ', source: 'pro_pilot' },
    } as RequestLike, res)
    expect(insert).toHaveBeenCalledWith({
      email: 'ada@pulse.app',
      source: 'pro_pilot',
      user_id: 'user-1',
    })
    expect(state.status).toBe(201)
    expect(state.body).toEqual({ data: { status: 'created', email: 'ada@pulse.app' } })
  })

  it('returns already registered on the second submit (unique violation)', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key value' } })
    mocks.createAdminClient.mockReturnValue({
      from: () => ({ insert }),
    })
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: { email: 'ada@pulse.app' } } as RequestLike, res)
    expect(state.status).toBe(200)
    expect(state.body).toEqual({ data: { status: 'already_registered', email: 'ada@pulse.app' } })
  })
})
