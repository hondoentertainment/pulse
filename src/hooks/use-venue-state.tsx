import { createContext, useContext } from 'react'
import type {
  Venue,
  Pulse,
  Notification,
  Hashtag,
  PulseWithUser,
  User,
} from '@/lib/types'
import { PulseStory } from '@/lib/stories'
import { VenueEvent } from '@/lib/events'
import { PulsePlaylist } from '@/lib/playlists'
import { PromotedVenue } from '@/lib/promoted-discoveries'
import { ContentReport, UserBlock, UserMute } from '@/lib/content-moderation'

export interface VenueState {
  // Venue data
  venues: Venue[] | undefined
  setVenues: (fn: ((v: Venue[] | undefined) => Venue[]) | Venue[]) => void
  pulses: Pulse[] | undefined
  setPulses: (fn: ((p: Pulse[] | undefined) => Pulse[]) | Pulse[]) => void
  notifications: Notification[] | undefined
  setNotifications: (fn: ((n: Notification[] | undefined) => Notification[]) | Notification[]) => void
  hashtags: Hashtag[] | undefined
  setHashtags: (fn: ((h: Hashtag[] | undefined) => Hashtag[]) | Hashtag[]) => void
  stories: PulseStory[] | undefined
  setStories: (fn: ((s: PulseStory[] | undefined) => PulseStory[]) | PulseStory[]) => void
  events: VenueEvent[] | undefined
  setEvents: (fn: ((e: VenueEvent[] | undefined) => VenueEvent[]) | VenueEvent[]) => void
  playlists: PulsePlaylist[] | undefined
  setPlaylists: (fn: ((p: PulsePlaylist[] | undefined) => PulsePlaylist[]) | PulsePlaylist[]) => void
  promotions: PromotedVenue[] | undefined
  setPromotions: (fn: ((p: PromotedVenue[] | undefined) => PromotedVenue[]) | PromotedVenue[]) => void
  contentReports: ContentReport[] | undefined
  setContentReports: (fn: ((r: ContentReport[] | undefined) => ContentReport[]) | ContentReport[]) => void
  userBlocks: UserBlock[] | undefined
  userMutes: UserMute[] | undefined

  // Location
  userLocation: { lat: number; lng: number } | null
  locationName: string
  locationError: string | undefined
  isTracking: boolean
  realtimeLocation: { lat: number; lng: number; accuracy?: number; heading?: number } | null
  locationPermissionDenied: boolean
  setLocationPermissionDenied: (v: boolean) => void
  simulatedLocation: { lat: number; lng: number } | null
  setSimulatedLocation: (v: { lat: number; lng: number } | null) => void

  // Preferences
  unitSystem: 'imperial' | 'metric'
  notificationSettings: any
  currentTime: Date

  // User (shared — needed for venue derivations)
  currentUser: User | undefined
  setCurrentUser: (fn: ((u: User | undefined) => User) | User) => void

  // Derived
  moderatedPulses: Pulse[]
  sortedVenues: Venue[]
  favoriteVenues: Venue[]
  followedVenues: Venue[]
  unreadNotificationCount: number
  isFavorite: (venueId: string) => boolean
  isFollowed: (venueId: string) => boolean
  getPulsesWithUsers: () => PulseWithUser[]
}

export const VenueContext = createContext<VenueState | null>(null)

export function useVenueState(): VenueState {
  const ctx = useContext(VenueContext)
  if (!ctx) throw new Error('useVenueState must be used within VenueProvider')
  return ctx
}
