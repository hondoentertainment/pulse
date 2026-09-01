import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestLike, ResponseLike } from '../../_lib/http'

const mocks = vi.hoisted(() => ({
  loaded: {
    supabaseServer: false,
    push: false,
    webPush: false,
  },
  createAdminClient: vi.fn(),
  sendPushToUser: vi.fn(),
  sendWebPushToUser: vi.fn(),
}))

vi.mock('../../_lib/supabase-server.js', () => {
  mocks.loaded.supabaseServer = true
  return { createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args) }
})
vi.mock('../../_lib/supabase-server.ts', () => {
  mocks.loaded.supabaseServer = true
  return { createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args) }
})
vi.mock('../../_lib/push.js', () => {
  mocks.loaded.push = true
  return { sendPushToUser: (...args: unknown[]) => mocks.sendPushToUser(...args) }
})
vi.mock('../../_lib/push.ts', () => {
  mocks.loaded.push = true
  return { sendPushToUser: (...args: unknown[]) => mocks.sendPushToUser(...args) }
})
vi.mock('../../_lib/web-push.js', () => {
  mocks.loaded.webPush = true
  return { sendWebPushToUser: (...args: unknown[]) => mocks.sendWebPushToUser(...args) }
})
vi.mock('../../_lib/web-push.ts', () => {
  mocks.loaded.webPush = true
  return { sendWebPushToUser: (...args: unknown[]) => mocks.sendWebPushToUser(...args) }
})

import handler from '../reminders/dispatch'

const dispatchSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../reminders/dispatch.ts'),
  'utf8',
)

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
      state.headers[name] = value
    },
    json(payload: unknown) {
      state.body = payload
    },
    end() {},
  }
  return { res, state }
}

describe('GET|POST /api/signal/reminders/dispatch', () => {
  const previous = {
    cron: process.env.CRON_SECRET,
    nodeEnv: process.env.NODE_ENV,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceLegacy: process.env.SUPABASE_SERVICE_ROLE,
  }

  beforeEach(() => {
    mocks.loaded.supabaseServer = false
    mocks.loaded.push = false
    mocks.loaded.webPush = false
    mocks.createAdminClient.mockReset()
    mocks.sendPushToUser.mockReset()
    mocks.sendWebPushToUser.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (previous.cron === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous.cron
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous.nodeEnv
    if (previous.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service
    if (previous.serviceLegacy === undefined) delete process.env.SUPABASE_SERVICE_ROLE
    else process.env.SUPABASE_SERVICE_ROLE = previous.serviceLegacy
  })

  it('has no static runtime relative imports (Vercel ESM boot crash)', () => {
    const withoutTypeImports = dispatchSource.replace(
      /import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"]/g,
      '',
    )
    const staticRuntime = [...withoutTypeImports.matchAll(/^import\s+[\s\S]*?from\s+['"](\.[^'"]+)['"]/gm)]
      .map((match) => match[1])
    expect(staticRuntime).toEqual([])

    const withoutComments = dispatchSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const relativeSpecifiers = [...withoutComments.matchAll(/from\s+['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)]
      .map((match) => match[1] ?? match[2])
    expect(relativeSpecifiers.length).toBeGreaterThan(0)
    expect(relativeSpecifiers.every((specifier) => specifier.endsWith('.js') || specifier.endsWith('.ts'))).toBe(true)
    expect(relativeSpecifiers.some((specifier) => specifier.includes('push.js'))).toBe(true)
    expect(relativeSpecifiers.some((specifier) => specifier.includes('supabase-server.js'))).toBe(true)
    expect(relativeSpecifiers.some((specifier) => specifier.includes('web-push.js'))).toBe(true)
  })

  it('returns 401 without loading supabase, native push, or web-push', async () => {
    delete process.env.CRON_SECRET
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE
    process.env.NODE_ENV = 'production'
    const { res, state } = makeResponse()
    await handler({ method: 'POST', body: {} } as RequestLike, res)
    expect(state.status).toBe(401)
    expect(state.body).toEqual({ error: 'Invalid cron secret' })
    expect(mocks.loaded.supabaseServer).toBe(false)
    expect(mocks.loaded.push).toBe(false)
    expect(mocks.loaded.webPush).toBe(false)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('rejects GET without a secret in production', async () => {
    delete process.env.CRON_SECRET
    process.env.NODE_ENV = 'production'
    const { res, state } = makeResponse()
    await handler({ method: 'GET' } as RequestLike, res)
    expect(state.status).toBe(401)
    expect(mocks.loaded.supabaseServer).toBe(false)
    expect(mocks.loaded.push).toBe(false)
    expect(mocks.loaded.webPush).toBe(false)
  })

  it('does not trust a spoofed x-vercel-cron header', async () => {
    process.env.CRON_SECRET = 'test-secret'
    process.env.NODE_ENV = 'production'
    const { res, state } = makeResponse()
    await handler({
      method: 'POST',
      headers: { 'x-vercel-cron': '1' },
    } as RequestLike, res)
    expect(state.status).toBe(401)
    expect(mocks.loaded.push).toBe(false)
    expect(mocks.loaded.webPush).toBe(false)
  })

  it('returns supabase_unconfigured without loading supabase or push when the admin key is missing', async () => {
    process.env.CRON_SECRET = 'test-secret'
    process.env.NODE_ENV = 'production'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE
    const { res, state } = makeResponse()
    await handler({
      method: 'GET',
      headers: { authorization: 'Bearer test-secret' },
    } as RequestLike, res)
    expect(state.status).toBe(200)
    expect(state.body).toEqual({ data: { dispatched: 0, logOnly: true, reason: 'supabase_unconfigured' } })
    expect(mocks.loaded.supabaseServer).toBe(false)
    expect(mocks.loaded.push).toBe(false)
    expect(mocks.loaded.webPush).toBe(false)
  })

  it('returns candidates/results when authorized and no one is in the window', async () => {
    process.env.CRON_SECRET = 'test-secret'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    mocks.createAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: async () => ({ data: [] }),
        }),
      }),
    })
    const { res, state } = makeResponse()
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    } as RequestLike, res)
    expect(state.status).toBe(200)
    expect(state.body).toEqual({ data: { candidates: 0, results: [] } })
    expect(mocks.loaded.supabaseServer).toBe(true)
    expect(mocks.loaded.push).toBe(false)
    expect(mocks.loaded.webPush).toBe(false)
  })

  it('fans out native + web push only after auth when there are recipients', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:05:00.000Z'))
    process.env.CRON_SECRET = 'test-secret'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    mocks.createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'signal_profiles') {
          return {
            select: () => ({
              eq: async () => ({
                data: [{
                  user_id: 'user-1',
                  reminder_enabled: true,
                  reminder_time: '00:00',
                  reminder_timezone: 'UTC',
                }],
              }),
            }),
          }
        }
        return {
          select: () => ({
            in: () => ({
              gte: async () => ({ data: [] }),
            }),
          }),
        }
      },
    })
    mocks.sendPushToUser.mockResolvedValue({
      userId: 'user-1', dispatched: 1, skipped: 0, logOnly: false, errors: [],
    })
    mocks.sendWebPushToUser.mockResolvedValue({
      userId: 'user-1', dispatched: 1, skipped: 0, logOnly: false, errors: [],
    })

    const { res, state } = makeResponse()
    await handler({
      method: 'POST',
      query: { secret: 'test-secret' },
    } as RequestLike, res)

    expect(state.status).toBe(200)
    const body = state.body as { data: { candidates: number; results: Array<{ userId: string; dispatched: number }> } }
    expect(body.data.candidates).toBe(1)
    expect(body.data.results[0]).toMatchObject({ userId: 'user-1', dispatched: 2 })
    expect(mocks.sendPushToUser).toHaveBeenCalledTimes(1)
    expect(mocks.sendWebPushToUser).toHaveBeenCalledTimes(1)
    expect(mocks.sendWebPushToUser.mock.calls[0]?.[0]).toMatchObject({
      data: { kind: 'signal_reminder' },
    })
    vi.useRealTimers()
  })
})
