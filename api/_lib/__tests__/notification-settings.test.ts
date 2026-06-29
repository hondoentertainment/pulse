import { describe, it, expect } from 'vitest'
import {
  mergeNotificationSettings,
  isFriendPulsesEnabled,
  parseNotificationSettingsPatch,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../notification-settings'

describe('notification-settings', () => {
  it('mergeNotificationSettings applies defaults for missing keys', () => {
    expect(mergeNotificationSettings({ friendPulses: false })).toMatchObject({
      friendPulses: false,
      trendingVenues: true,
    })
  })

  it('isFriendPulsesEnabled defaults to true', () => {
    expect(isFriendPulsesEnabled(null)).toBe(true)
    expect(isFriendPulsesEnabled({ friendPulses: false })).toBe(false)
  })

  it('parseNotificationSettingsPatch rejects non-boolean values', () => {
    const result = parseNotificationSettingsPatch({ friendPulses: 'yes' })
    expect(result.ok).toBe(false)
  })

  it('parseNotificationSettingsPatch accepts partial updates', () => {
    const result = parseNotificationSettingsPatch({ pulseReactions: false })
    expect(result).toEqual({ ok: true, patch: { pulseReactions: false } })
  })

  it('DEFAULT_NOTIFICATION_SETTINGS matches client defaults', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.friendPulses).toBe(true)
    expect(DEFAULT_NOTIFICATION_SETTINGS.weeklyDigest).toBe(false)
  })
})
