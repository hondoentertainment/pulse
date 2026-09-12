import { describe, expect, it } from 'vitest'
import { hasVapidKeys, notifyLivePulse } from '../web-push-live.js'

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

  it('requires both public and private keys', () => {
    expect(hasVapidKeys({ VAPID_PUBLIC_KEY: 'only-public' })).toBe(false)
    expect(hasVapidKeys({ VAPID_PRIVATE_KEY: 'only-private' })).toBe(false)
    expect(hasVapidKeys({
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
    })).toBe(true)
  })
})
