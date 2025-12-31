import { useKV } from '@github/spark/hooks'

export interface NotificationSettings {
  friendPulses: boolean
  friendNearbyVenues: boolean
  trendingVenues: boolean
  pulseReactions: boolean
  weeklyDigest: boolean
  groupReactions: boolean
  groupFriendPulses: boolean
  groupTrendingVenues: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
  friendPulses: true,
  friendNearbyVenues: true,
  trendingVenues: true,
  pulseReactions: true,
  weeklyDigest: false,
  groupReactions: true,
  groupFriendPulses: false,
  groupTrendingVenues: false
}

export function useNotificationSettings() {
  const [settings, setSettings] = useKV<NotificationSettings>(
    'notification-settings',
    DEFAULT_SETTINGS
  )

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings((current) => {
      if (!current) return DEFAULT_SETTINGS
      return {
        ...current,
        [key]: value
      }
    })
  }

  return {
    settings,
    updateSetting
  }
}
