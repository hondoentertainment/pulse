import { describe, expect, it } from 'vitest'
import { hasVapidKeys } from '../web-push-live.js'
import { notifyImHere } from '../web-push-im-here.js'

describe('notifyImHere', () => {
  it('no-ops honestly when VAPID keys are missing', async () => {
    expect(hasVapidKeys({})).toBe(false)
    const result = await notifyImHere(
      { userId: 'user-1', venueId: 'neumos', venueName: 'Neumos' },
      {},
    )
    expect(result).toEqual({
      attempted: false,
      sent: 0,
      skipped: 0,
      selfSent: 0,
      followerSent: 0,
      reason: 'missing_vapid',
    })
  })
})
