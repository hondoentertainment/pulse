import { describe, expect, it } from 'vitest'
import { encodeGlancePush } from '../../../src/lib/glance-push.js'
import { venueSurgeNotifyPayload } from '../../../src/lib/venue-surge-notify.js'
import { hasVapidKeys, hasVenueSurgeVapid, notifyLivePulse } from '../web-push-live.js'

describe('notifyLivePulse', () => {
  it('no-ops honestly when VAPID keys are missing', async () => {
    expect(hasVapidKeys({})).toBe(false)
    const result = await notifyLivePulse(
      { venueId: 'neumos', venueName: 'Neumos', caption: 'Packed' },
      {},
    )
    expect(result).toEqual({
      attempted: false,
      sent: 0,
      skipped: 0,
      reason: 'missing_vapid',
    })
  })

  it('encodes Electric surge glances with kind, tag, and a venue deep link', () => {
    const encoded = JSON.parse(encodeGlancePush(venueSurgeNotifyPayload({
      venueId: 'neumos',
      venueName: 'Neumos',
    }))) as {
      title: string
      body: string
      data: { url: string; kind: string; tag: string; renotify: boolean }
    }
    expect(encoded.title).toBe('Neumos · Surging')
    expect(encoded.body).toBe('Electric right now')
    expect(encoded.data).toEqual({
      url: '/venue/neumos',
      kind: 'venue_surge',
      tag: 'venue-surge:neumos',
      renotify: true,
    })
  })

  it('requires both public and private keys for the shared sender', () => {
    expect(hasVapidKeys({ VAPID_PUBLIC_KEY: 'only-public' })).toBe(false)
    expect(hasVapidKeys({ VAPID_PRIVATE_KEY: 'only-private' })).toBe(false)
    expect(hasVapidKeys({
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
    })).toBe(true)
  })

  it('stays a surge no-op unless the Vite public key matches the server key', () => {
    expect(hasVenueSurgeVapid({})).toBe(false)
    expect(hasVenueSurgeVapid({
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
    })).toBe(false)
    expect(hasVenueSurgeVapid({
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
      VITE_VAPID_PUBLIC_KEY: 'other',
    })).toBe(false)
    expect(hasVenueSurgeVapid({
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
      VITE_VAPID_PUBLIC_KEY: 'public',
    })).toBe(true)
  })
})
