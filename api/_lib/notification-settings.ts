/**
 * Server-side notification preference helpers.
 * Shape mirrors `src/hooks/use-notification-settings.ts`.
 */

export interface NotificationSettingsJson {
  friendPulses?: boolean
  friendNearbyVenues?: boolean
  trendingVenues?: boolean
  pulseReactions?: boolean
  weeklyDigest?: boolean
  groupReactions?: boolean
  groupFriendPulses?: boolean
  groupTrendingVenues?: boolean
}

export const DEFAULT_NOTIFICATION_SETTINGS: Required<NotificationSettingsJson> = {
  friendPulses: true,
  friendNearbyVenues: true,
  trendingVenues: true,
  pulseReactions: true,
  weeklyDigest: false,
  groupReactions: true,
  groupFriendPulses: false,
  groupTrendingVenues: false,
}

export function mergeNotificationSettings(
  raw: unknown,
): Required<NotificationSettingsJson> {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NOTIFICATION_SETTINGS }
  const o = raw as NotificationSettingsJson
  return {
    friendPulses: o.friendPulses ?? DEFAULT_NOTIFICATION_SETTINGS.friendPulses,
    friendNearbyVenues: o.friendNearbyVenues ?? DEFAULT_NOTIFICATION_SETTINGS.friendNearbyVenues,
    trendingVenues: o.trendingVenues ?? DEFAULT_NOTIFICATION_SETTINGS.trendingVenues,
    pulseReactions: o.pulseReactions ?? DEFAULT_NOTIFICATION_SETTINGS.pulseReactions,
    weeklyDigest: o.weeklyDigest ?? DEFAULT_NOTIFICATION_SETTINGS.weeklyDigest,
    groupReactions: o.groupReactions ?? DEFAULT_NOTIFICATION_SETTINGS.groupReactions,
    groupFriendPulses: o.groupFriendPulses ?? DEFAULT_NOTIFICATION_SETTINGS.groupFriendPulses,
    groupTrendingVenues: o.groupTrendingVenues ?? DEFAULT_NOTIFICATION_SETTINGS.groupTrendingVenues,
  }
}

export function isFriendPulsesEnabled(raw: unknown): boolean {
  return mergeNotificationSettings(raw).friendPulses
}

/** Validate a partial PATCH body — only known boolean keys allowed. */
export function parseNotificationSettingsPatch(
  body: unknown,
): { ok: true; patch: Partial<NotificationSettingsJson> } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body must be a JSON object' }
  }
  const patch: Partial<NotificationSettingsJson> = {}
  const keys = Object.keys(DEFAULT_NOTIFICATION_SETTINGS) as (keyof NotificationSettingsJson)[]
  for (const key of keys) {
    if (!(key in body)) continue
    const value = (body as Record<string, unknown>)[key]
    if (typeof value !== 'boolean') {
      return { ok: false, error: `${key} must be a boolean` }
    }
    patch[key] = value
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'Provide at least one preference to update' }
  }
  return { ok: true, patch }
}
