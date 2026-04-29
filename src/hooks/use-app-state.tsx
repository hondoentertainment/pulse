import { useState, useEffect, useMemo, useCallback, createContext, useContext, type ReactNode } from 'react'
import { useKV } from '@github/spark/hooks'
import type {
  Venue,
  Pulse,
  User,
  Notification,
  Hashtag,
  PulseWithUser,
} from '@/lib/types'
import { PulseStory } from '@/lib/stories'
import { VenueEvent } from '@/lib/events'
import { Crew, CrewCheckIn } from '@/lib/crew-mode'
import { PulsePlaylist } from '@/lib/playlists'
import { PromotedVenue, createPromotedVenue } from '@/lib/promoted-discoveries'
import { ContentReport, UserBlock, UserMute, filterModeratedPulses } from '@/lib/content-moderation'
import {
  calculatePulseScore,
  getVenuesByProximity,
} from '@/lib/pulse-engine'
import { initHighContrast } from '@/lib/accessibility'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { useNotificationSettings } from '@/hooks/use-notification-settings'
import { useRealtimeLocation } from '@/hooks/use-realtime-location'
import { useVenueSurgeTracker } from '@/hooks/use-venue-surge-tracker'
import { createEvent } from '@/lib/events'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { initializeSeededHashtags, applyHashtagDecay } from '@/lib/seeded-hashtags'
import { calculateScoreVelocity } from '@/lib/venue-trending'
import { fetchEventsFromApi, postEventToApi } from '@/lib/server-api'
import { fetchVenuesFromSupabase, fetchPulsesFromSupabase } from '@/lib/supabase-api'
import { hasSupabaseConfig, supabase } from '@/lib/supabase'
import { trackEvent, trackError, trackPerformance } from '@/lib/analytics'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import type { TabId } from '@/components/BottomNav'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription'
import { loadPrototypeCatalog, loadSimulatedLocation } from '@/lib/prototype-catalog'

export type SubPage =
  | 'events'
  | 'crews'
  | 'achievements'
  | 'insights'
  | 'neighborhoods'
  | 'playlists'
  | 'settings'
  | 'integrations'
  | 'moderation'
  | 'owner-dashboard'
  | 'challenges'
  | 'my-tickets'
  | 'night-planner'
  | null

export const ALL_USERS: User[] = [
  { id: 'user-2', username: 'sarah_j', profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
  { id: 'user-3', username: 'mike_v', profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
  { id: 'user-4', username: 'alex_k', profilePhoto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
  { id: 'user-5', username: 'jess_m', profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', friends: [], createdAt: new Date().toISOString() },
  { id: 'user-6', username: 'tom_b', profilePhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', friends: [], createdAt: new Date().toISOString() },
]

export interface AppState {
  // Navigation
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  selectedVenue: Venue | null
  setSelectedVenue: (v: Venue | null) => void
  subPage: SubPage
  setSubPage: (p: SubPage) => void

  // Onboarding
  hasCompletedOnboarding: boolean | undefined
  setHasCompletedOnboarding: (v: boolean) => void

  // Data
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
  crews: Crew[] | undefined
  setCrews: (fn: ((c: Crew[] | undefined) => Crew[]) | Crew[]) => void
  crewCheckIns: CrewCheckIn[] | undefined
  setCrewCheckIns: (fn: ((c: CrewCheckIn[] | undefined) => CrewCheckIn[]) | CrewCheckIn[]) => void
  playlists: PulsePlaylist[] | undefined
  setPlaylists: (fn: ((p: PulsePlaylist[] | undefined) => PulsePlaylist[]) | PulsePlaylist[]) => void
  promotions: PromotedVenue[] | undefined
  setPromotions: (fn: ((p: PromotedVenue[] | undefined) => PromotedVenue[]) | PromotedVenue[]) => void
  contentReports: ContentReport[] | undefined
  setContentReports: (fn: ((r: ContentReport[] | undefined) => ContentReport[]) | ContentReport[]) => void
  userBlocks: UserBlock[] | undefined
  userMutes: UserMute[] | undefined

  // User
  currentUser: User | undefined
  setCurrentUser: (fn: ((u: User | undefined) => User) | User) => void

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
  notificationSettings: ReturnType<typeof useNotificationSettings>['settings']

  // Feature flags
  integrationsEnabled: boolean
  socialDashboardEnabled: boolean

  // UI state
  createDialogOpen: boolean
  setCreateDialogOpen: (v: boolean) => void
  venueForPulse: Venue | null
  setVenueForPulse: (v: Venue | null) => void
  showAdminDashboard: boolean
  setShowAdminDashboard: (v: boolean) => void
  trendingSubTab: 'trending' | 'my-spots'
  setTrendingSubTab: (v: 'trending' | 'my-spots') => void
  storyViewerOpen: boolean
  setStoryViewerOpen: (v: boolean) => void
  storyViewerStories: PulseStory[]
  setStoryViewerStories: (v: PulseStory[]) => void
  integrationVenue: Venue | null
  setIntegrationVenue: (v: Venue | null) => void
  presenceSheetOpen: boolean
  setPresenceSheetOpen: (v: boolean) => void
  queuedPulseCount: number
  setQueuedPulseCount: (v: number) => void

  // Derived
  moderatedPulses: Pulse[]
  sortedVenues: Venue[]
  favoriteVenues: Venue[]
  followedVenues: Venue[]
  unreadNotificationCount: number
  isFavorite: (venueId: string) => boolean
  isFollowed: (venueId: string) => boolean
  getPulsesWithUsers: () => PulseWithUser[]
  pulsesWithUsers: PulseWithUser[]
}

const AppStateContext = createContext<AppState | null>(null)

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}

export function getInitialCatalogState(initialVenues: Venue[]) {
  return {
    venues: hasSupabaseConfig ? undefined : initialVenues,
    pulses: hasSupabaseConfig ? undefined : [],
  }
}

export function getCurrentUserFromProfile(profile: User | null): User | undefined {
  return profile ?? undefined
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useKV<boolean>('hasCompletedOnboarding', false)
  const [activeTab, setActiveTab] = useState<TabId>('trending')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [presenceSheetOpen, setPresenceSheetOpen] = useState(false)
  const [subPage, setSubPage] = useState<SubPage>(null)
  const [storyViewerOpen, setStoryViewerOpen] = useState(false)
  const [storyViewerStories, setStoryViewerStories] = useState<PulseStory[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [venueForPulse, setVenueForPulse] = useState<Venue | null>(null)
  const [locationName, setLocationName] = useState<string>('')
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [trendingSubTab, setTrendingSubTab] = useState<'trending' | 'my-spots'>('trending')
  const [integrationVenue, setIntegrationVenue] = useState<Venue | null>(null)
  const [simulatedLocation, setSimulatedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)
  const [queuedPulseCount, setQueuedPulseCount] = useState(0)

  const integrationsEnabled = isFeatureEnabled('integrations')
  const socialDashboardEnabled = isFeatureEnabled('socialDashboard')
  const { unitSystem } = useUnitPreference()
  const { settings: notificationSettings } = useNotificationSettings()
  const { location: realtimeLocation, error: locationError, isTracking } = useRealtimeLocation({
    enableHighAccuracy: true,
    distanceFilter: 0.001,
  })

  const { profile: supabaseProfile } = useSupabaseAuth()

  const [currentUser, setCurrentUser] = useState<User | undefined>(undefined)
  const [prototypeVenues, setPrototypeVenues] = useState<Venue[]>([])

  // Bridge Supabase Profile -> Local State
  useEffect(() => {
    setCurrentUser(getCurrentUserFromProfile(supabaseProfile))
  }, [supabaseProfile])

  const launchedCities = useMemo(
    () => (import.meta.env.VITE_LAUNCHED_CITIES ?? '')
      .split(',')
      .map((city: string) => city.trim())
      .filter(Boolean),
    []
  )

  const [pulses, setPulses] = useState<Pulse[] | undefined>(hasSupabaseConfig ? undefined : [])
  const [venues, setVenues] = useState<Venue[] | undefined>(hasSupabaseConfig ? undefined : undefined)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [hashtags, setHashtags] = useState<Hashtag[]>([])
  const [stories, setStories] = useState<PulseStory[]>([])
  const [events, setEvents] = useState<VenueEvent[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [crewCheckIns, setCrewCheckIns] = useState<CrewCheckIn[]>([])
  const [playlists, setPlaylists] = useState<PulsePlaylist[]>([])
  const [promotions, setPromotions] = useState<PromotedVenue[]>([])
  const [contentReports, setContentReports] = useState<ContentReport[]>([])
  const [userBlocks] = useState<UserBlock[]>([])
  const [userMutes] = useState<UserMute[]>([])

  // ── Side-effects ─────────────────────────────────────────
  // Activate batched Supabase Realtime subscriptions (Phase 6)
  useRealtimeSubscription(true)

  useEffect(() => {
    if (hasSupabaseConfig) return

    let isMounted = true
    const startedAt = Date.now()

    loadPrototypeCatalog(launchedCities)
      .then((catalog) => {
        if (!isMounted) return

        setPrototypeVenues(catalog.venues)
        setVenues((current) => current ?? catalog.venues)
        setPulses((current) => current ?? catalog.pulses)
        trackPerformance('prototype_catalog_ready', Date.now() - startedAt)
      })
      .catch((error) => {
        if (!isMounted) return

        trackError(error instanceof Error ? error : String(error), 'prototype_catalog_bootstrap')
        setPrototypeVenues([])
        setVenues((current) => current ?? [])
        setPulses((current) => current ?? [])
      })

    return () => {
      isMounted = false
    }
  }, [launchedCities])

  useEffect(() => {
    if (!hashtags || hashtags.length === 0) setHashtags(initializeSeededHashtags())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { initHighContrast() }, [])

  const { data: serverEvents } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEventsFromApi,
  })

  const { data: serverVenues } = useQuery({
    queryKey: ['venues'],
    queryFn: fetchVenuesFromSupabase,
    enabled: hasSupabaseConfig,
  })

  const { data: serverPulses } = useQuery({
    queryKey: ['pulses'],
    queryFn: fetchPulsesFromSupabase,
    enabled: hasSupabaseConfig,
  })

  // Seed demo events / promotions
  useEffect(() => {
    if ((!events || events.length === 0) && (!Array.isArray(serverEvents) || serverEvents.length === 0)) {
      if (venues && venues.length > 0) {
        const now = new Date()
        const demoEvents = [
          createEvent(venues[0].id, 'user-2', 'Friday Night DJ Set', 'Live DJ spinning house & techno all night', 'dj_set', new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(), new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString()),
          createEvent(venues[1]?.id || venues[0].id, 'user-3', 'Trivia Tuesday', 'Test your knowledge — prizes for top 3 teams!', 'trivia', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), new Date(now.getTime() + 27 * 60 * 60 * 1000).toISOString()),
          createEvent(venues[2]?.id || venues[0].id, 'user-4', 'Happy Hour Special', '$5 cocktails and half-price apps', 'happy_hour', new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString()),
        ]
        setEvents(demoEvents)
        Promise.allSettled(demoEvents.map(e => postEventToApi(e))).catch(() => { })
      }
    }
    if (!promotions || promotions.length === 0) {
      if (venues && venues.length > 2) {
        setPromotions([
          createPromotedVenue(venues[0].id, 'Weekend Spotlight', 200, 'cpc', 0.5, 7),
          createPromotedVenue(venues[2]?.id || venues[0].id, 'Happy Hour Boost', 100, 'cpm', 2, 14),
        ])
      }
    }
  }, [events, promotions, serverEvents, venues])

  // Hydrate local KV state from React Query
  useEffect(() => {
    if (Array.isArray(serverEvents) && serverEvents.length > 0) setEvents(serverEvents)
  }, [serverEvents, setEvents])

  useEffect(() => {
    if (Array.isArray(serverVenues)) setVenues(serverVenues)
  }, [serverVenues, setVenues])

  useEffect(() => {
    if (Array.isArray(serverPulses)) setPulses(serverPulses)
  }, [serverPulses, setPulses])

  useEffect(() => {
    if (!selectedVenue || !venues) return
    const refreshedVenue = venues.find(venue => venue.id === selectedVenue.id)
    if (refreshedVenue && refreshedVenue !== selectedVenue) {
      setSelectedVenue(refreshedVenue)
    }
  }, [selectedVenue, venues])

  // Location
  const userLocation = useMemo(
    () => realtimeLocation ? { lat: realtimeLocation.lat, lng: realtimeLocation.lng } : simulatedLocation,
    [realtimeLocation, simulatedLocation]
  )
  const realtimeLocationValue = useMemo(
    () => realtimeLocation ? { ...realtimeLocation, heading: realtimeLocation.heading ?? undefined } : null,
    [realtimeLocation]
  )
  const locationLookupKey = useMemo(
    () => userLocation ? `${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}` : null,
    [userLocation]
  )

  useVenueSurgeTracker(venues || [], userLocation, notificationSettings?.trendingVenues ?? true)

  useEffect(() => {
    if (hasSupabaseConfig || realtimeLocation || simulatedLocation || locationPermissionDenied) return

    const timer = setTimeout(() => {
      if (realtimeLocation) return
      loadSimulatedLocation()
        .then((pos) => {
          setSimulatedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        })
        .catch((error) => {
          trackError(error instanceof Error ? error : String(error), 'simulated_location_bootstrap')
        })
    }, 2000)

    return () => clearTimeout(timer)
  }, [locationPermissionDenied, realtimeLocation, simulatedLocation])

  useEffect(() => {
    if (!locationLookupKey) return

    const [lat, lng] = locationLookupKey.split(',').map(Number)

    if (!hasSupabaseConfig) {
      if (prototypeVenues.length === 0) return

      const fallbackVenue = getVenuesByProximity(prototypeVenues, lat, lng)[0]
      if (fallbackVenue?.city && fallbackVenue?.state) {
        setLocationName(`${fallbackVenue.city}, ${fallbackVenue.state}`)
        return
      }
      setLocationName('Nearby')
      return
    }

    let isMounted = true

    supabase.functions.invoke('geocode', {
      method: 'POST',
      body: { lat: lat.toString(), lng: lng.toString() }
    })
    .then(({ data, error }) => {
      if (!isMounted) return
      if (error) throw error
      const city = data.address?.city || data.address?.town || data.address?.village || 'New York'
      const state = data.address?.state || 'NY'
      setLocationName(`${city}, ${state}`)
    })
    .catch((err) => {
      if (!isMounted) return
      trackError(err instanceof Error ? err : String(err), 'location_geocode')
      setLocationName('New York, NY')
    })

    return () => {
      isMounted = false
    }
  }, [locationLookupKey, prototypeVenues])

  useEffect(() => {
    if (locationError) {
      if (locationError.includes('denied')) {
        setLocationPermissionDenied(true)
        toast.error('Location Access Needed', { description: 'Grant location permission to see venues near you', duration: 5000 })
      } else {
        toast.error('Location Error', { description: locationError, duration: 3000 })
      }
    }
  }, [locationError])

  // Analytics tracking for venue views
  useEffect(() => {
    if (selectedVenue) {
      const source = activeTab === 'map' ? 'map' : activeTab === 'discover' ? 'search' : activeTab === 'notifications' ? 'notification' : 'trending'
      trackEvent({ type: 'venue_view', timestamp: Date.now(), venueId: selectedVenue.id, source })
    }
  }, [selectedVenue, activeTab])

  // Score recalculation interval
  const pulsesByVenue = useMemo(() => {
    const byVenue = new Map<string, Pulse[]>()
    for (const pulse of pulses || []) {
      const venuePulses = byVenue.get(pulse.venueId)
      if (venuePulses) {
        venuePulses.push(pulse)
      } else {
        byVenue.set(pulse.venueId, [pulse])
      }
    }
    for (const venuePulses of byVenue.values()) {
      venuePulses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return byVenue
  }, [pulses])

  useEffect(() => {
    const interval = setInterval(() => {
      setVenues((current) => {
        if (!current) return []
        return current.map((venue) => {
          const venuePulses = pulsesByVenue.get(venue.id) || []
          const score = calculatePulseScore(venuePulses)
          const velocity = calculateScoreVelocity(venue, venuePulses)
          const lastPulse = venuePulses[0]
          return { ...venue, pulseScore: score, scoreVelocity: velocity, lastPulseAt: lastPulse?.createdAt }
        })
      })
      setHashtags((current) => { if (!current) return []; return applyHashtagDecay(current) })
    }, 5000)
    return () => clearInterval(interval)
  }, [pulsesByVenue, setVenues, setHashtags])

  // ── Derived values ───────────────────────────────────────
  const moderatedPulses = useMemo(
    () => filterModeratedPulses(pulses || [], currentUser?.id || '', userBlocks || [], userMutes || []),
    [currentUser?.id, pulses, userBlocks, userMutes]
  )
  const unreadNotificationCount = useMemo(
    () => (notifications || []).filter(n => !n.read).length,
    [notifications]
  )

  const sortedVenues = useMemo(
    () => userLocation
      ? getVenuesByProximity(venues || [], userLocation.lat, userLocation.lng)
      : [...(venues || [])].sort((a, b) => b.pulseScore - a.pulseScore),
    [userLocation, venues]
  )

  const venueById = useMemo(
    () => new Map((venues || []).map(venue => [venue.id, venue] as const)),
    [venues]
  )
  const favoriteVenueIds = useMemo(
    () => new Set(currentUser?.favoriteVenues || []),
    [currentUser?.favoriteVenues]
  )
  const followedVenueIds = useMemo(
    () => new Set(currentUser?.followedVenues || []),
    [currentUser?.followedVenues]
  )

  const favoriteVenues = useMemo(
    () => (currentUser?.favoriteVenues || [])
      .map(id => venueById.get(id))
      .filter((v): v is Venue => v !== undefined),
    [currentUser?.favoriteVenues, venueById]
  )

  const followedVenues = useMemo(
    () => (currentUser?.followedVenues || [])
      .map(id => venueById.get(id))
      .filter((v): v is Venue => v !== undefined),
    [currentUser?.followedVenues, venueById]
  )

  const isFavorite = useCallback((venueId: string) => favoriteVenueIds.has(venueId), [favoriteVenueIds])
  const isFollowed = useCallback((venueId: string) => followedVenueIds.has(venueId), [followedVenueIds])

  const pulsesWithUsers = useMemo<PulseWithUser[]>(() => {
    if (!currentUser || !venues) return []
    return moderatedPulses
      .map(pulse => ({ ...pulse, user: currentUser, venue: venueById.get(pulse.venueId)! }))
      .filter(p => p.venue)
  }, [currentUser, moderatedPulses, venueById, venues])

  const getPulsesWithUsers = useCallback(() => pulsesWithUsers, [pulsesWithUsers])

  const value: AppState = useMemo(() => ({
    activeTab, setActiveTab,
    selectedVenue, setSelectedVenue,
    subPage, setSubPage,
    hasCompletedOnboarding, setHasCompletedOnboarding,
    venues, setVenues,
    pulses, setPulses,
    notifications, setNotifications,
    hashtags, setHashtags,
    stories, setStories,
    events, setEvents,
    crews, setCrews,
    crewCheckIns, setCrewCheckIns,
    playlists, setPlaylists,
    promotions, setPromotions,
    contentReports, setContentReports,
    userBlocks, userMutes,
    currentUser, setCurrentUser,
    userLocation, locationName, locationError: locationError ?? undefined, isTracking,
    realtimeLocation: realtimeLocationValue, locationPermissionDenied, setLocationPermissionDenied,
    simulatedLocation, setSimulatedLocation,
    unitSystem, notificationSettings,
    integrationsEnabled, socialDashboardEnabled,
    createDialogOpen, setCreateDialogOpen,
    venueForPulse, setVenueForPulse,
    showAdminDashboard, setShowAdminDashboard,
    trendingSubTab, setTrendingSubTab,
    storyViewerOpen, setStoryViewerOpen,
    storyViewerStories, setStoryViewerStories,
    integrationVenue, setIntegrationVenue,
    presenceSheetOpen, setPresenceSheetOpen,
    queuedPulseCount, setQueuedPulseCount,
    moderatedPulses, sortedVenues, favoriteVenues, followedVenues,
    unreadNotificationCount, isFavorite, isFollowed, getPulsesWithUsers, pulsesWithUsers,
  }), [
    activeTab,
    selectedVenue,
    subPage,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    venues,
    pulses,
    notifications,
    hashtags,
    stories,
    events,
    crews,
    crewCheckIns,
    playlists,
    promotions,
    contentReports,
    userBlocks,
    userMutes,
    currentUser,
    userLocation,
    locationName,
    locationError,
    isTracking,
    realtimeLocationValue,
    locationPermissionDenied,
    simulatedLocation,
    unitSystem,
    notificationSettings,
    integrationsEnabled,
    socialDashboardEnabled,
    createDialogOpen,
    venueForPulse,
    showAdminDashboard,
    trendingSubTab,
    storyViewerOpen,
    storyViewerStories,
    integrationVenue,
    presenceSheetOpen,
    queuedPulseCount,
    moderatedPulses,
    sortedVenues,
    favoriteVenues,
    followedVenues,
    unreadNotificationCount,
    isFavorite,
    isFollowed,
    getPulsesWithUsers,
    pulsesWithUsers,
  ])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
