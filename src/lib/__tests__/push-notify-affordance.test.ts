import { describe, expect, it } from 'vitest'
import { shouldShowPushNotifyAffordance } from '../push-notify-affordance'

describe('shouldShowPushNotifyAffordance', () => {
  it('shows after Follow even when VAPID is missing so the UI can no-op honestly', () => {
    expect(shouldShowPushNotifyAffordance({
      signedIn: true,
      vapidPublicKey: null,
      trigger: 'follow',
    })).toBe(true)
  })

  it('stays hidden for guests and when there is no trigger', () => {
    expect(shouldShowPushNotifyAffordance({
      signedIn: false,
      vapidPublicKey: 'key',
      trigger: 'follow',
    })).toBe(false)
    expect(shouldShowPushNotifyAffordance({
      signedIn: true,
      vapidPublicKey: 'key',
      trigger: 'none',
    })).toBe(false)
  })
})
