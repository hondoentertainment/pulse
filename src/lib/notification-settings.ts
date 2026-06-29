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

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  friendPulses: true,
  friendNearbyVenues: true,
  trendingVenues: true,
  pulseReactions: true,
  weeklyDigest: false,
  groupReactions: true,
  groupFriendPulses: false,
  groupTrendingVenues: false,
}
