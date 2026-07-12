import type { User } from './types'
import { isVenueAppMode } from './app-mode'

export const GUEST_BROWSE_KV_KEY = 'pulse-guest-browse'

export const GUEST_BROWSE_USER: User = {
  id: 'guest-browser',
  username: 'guest',
  friends: [],
  favoriteVenues: [],
  followedVenues: [],
  createdAt: new Date().toISOString(),
}

export function isGuestBrowseEnabled(): boolean {
  const flag = import.meta.env.VITE_ALLOW_GUEST_BROWSE
  if (typeof flag === 'string') {
    const normalized = flag.trim().toLowerCase()
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  }
  return isVenueAppMode()
}

export function isGuestUser(user: User | undefined | null): boolean {
  return user?.id === GUEST_BROWSE_USER.id
}
