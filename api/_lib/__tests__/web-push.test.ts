import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildWebPushPayload, notificationOpenUrl, sanitizeSignalPushData, sendWebPushToUser } from '../web-push'

describe('sendWebPushToUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('delivers to stored Web Push subscriptions', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' },
    ]), { status: 200 })))

    const deliver = vi.fn(async () => ({ ok: true }))
    const result = await sendWebPushToUser({
      userId: 'user-1',
      title: 'Pulse Signal',
      body: 'Take 10 seconds to log today’s signal.',
    }, deliver)

    expect(deliver).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ dispatched: 1, skipped: 0, logOnly: false })
  })

  it('stays log-only when VAPID keys are missing and no deliverer is passed', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' },
    ]), { status: 200 })))

    const result = await sendWebPushToUser({
      userId: 'user-1',
      title: 'Pulse Signal',
      body: 'nudge',
    })

    expect(result.logOnly).toBe(true)
    expect(result.dispatched).toBe(0)
  })

  it('strips slider values from the Web Push payload', () => {
    const payload = JSON.parse(buildWebPushPayload({
      userId: 'user-1',
      title: 'Pulse Signal',
      body: 'Take 10 seconds to log today’s signal.',
      data: {
        kind: 'signal_reminder',
        dayKey: '2026-08-30',
        energy: '9',
        mood: '8',
        score: '88',
      },
    }))
    expect(payload.data).toEqual({ kind: 'signal_reminder', dayKey: '2026-08-30' })
    expect(sanitizeSignalPushData({ stress: 3, url: '/home' })).toEqual({ url: '/home' })
    expect(notificationOpenUrl({ kind: 'signal_reminder' })).toBe('/home')
  })
})
