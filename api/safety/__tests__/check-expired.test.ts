import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestLike, ResponseLike } from '../../_lib/http'

const mocks = vi.hoisted(() => ({
  loaded: { notify: false, safetyServer: false },
  sendPush: vi.fn(),
  sendSms: vi.fn(),
  getServiceClient: vi.fn(),
}))

vi.mock('../../_lib/notify.js', () => {
  mocks.loaded.notify = true
  return {
    sendPush: (...args: unknown[]) => mocks.sendPush(...args),
    sendSms: (...args: unknown[]) => mocks.sendSms(...args),
  }
})
vi.mock('../../_lib/notify.ts', () => {
  mocks.loaded.notify = true
  return {
    sendPush: (...args: unknown[]) => mocks.sendPush(...args),
    sendSms: (...args: unknown[]) => mocks.sendSms(...args),
  }
})
vi.mock('../../_lib/safety-server.js', async () => {
  mocks.loaded.safetyServer = true
  const actual = await vi.importActual<typeof import('../../_lib/safety-server')>('../../_lib/safety-server')
  return {
    ...actual,
    getServiceClient: (...args: unknown[]) => mocks.getServiceClient(...args),
  }
})
vi.mock('../../_lib/safety-server.ts', async () => {
  mocks.loaded.safetyServer = true
  const actual = await vi.importActual<typeof import('../../_lib/safety-server')>('../../_lib/safety-server')
  return {
    ...actual,
    getServiceClient: (...args: unknown[]) => mocks.getServiceClient(...args),
  }
})

import handler from '../cron/check-expired'

const cronSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../cron/check-expired.ts'),
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

describe('GET /api/safety/cron/check-expired', () => {
  const previous = {
    cron: process.env.CRON_SECRET,
  }

  beforeEach(() => {
    mocks.loaded.notify = false
    mocks.loaded.safetyServer = false
    mocks.sendPush.mockReset()
    mocks.sendSms.mockReset()
    mocks.getServiceClient.mockReset()
  })

  afterEach(() => {
    if (previous.cron === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous.cron
  })

  it('uses explicit .js/.ts relative specifiers (Vercel ESM)', () => {
    const withoutComments = cronSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const relativeSpecifiers = [...withoutComments.matchAll(/from\s+['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)]
      .map((match) => match[1] ?? match[2])
    expect(relativeSpecifiers.length).toBeGreaterThan(0)
    expect(relativeSpecifiers.every((specifier) => specifier.endsWith('.js') || specifier.endsWith('.ts'))).toBe(true)
    expect(relativeSpecifiers.some((specifier) => specifier.includes('notify.js'))).toBe(true)
    expect(relativeSpecifiers.some((specifier) => specifier.includes('safety-server.js'))).toBe(true)
  })

  it('returns 401 without a cron secret and does not crash', async () => {
    process.env.CRON_SECRET = 'test-secret'
    const { res, state } = makeResponse()
    await handler({ method: 'GET' } as RequestLike, res)
    expect(state.status).toBe(401)
    expect(state.body).toEqual({ error: 'unauthorized' })
    expect(mocks.getServiceClient).not.toHaveBeenCalled()
    expect(mocks.sendPush).not.toHaveBeenCalled()
    expect(mocks.sendSms).not.toHaveBeenCalled()
  })

  it('returns a log-only ok when authorized and supabase is unconfigured', async () => {
    process.env.CRON_SECRET = 'test-secret'
    mocks.getServiceClient.mockReturnValue(null)
    const { res, state } = makeResponse()
    await handler({
      method: 'GET',
      headers: { authorization: 'Bearer test-secret' },
    } as RequestLike, res)
    expect(state.status).toBe(200)
    expect(state.body).toEqual({ data: { ok: true, devFallback: true } })
    expect(mocks.sendPush).not.toHaveBeenCalled()
  })
})
