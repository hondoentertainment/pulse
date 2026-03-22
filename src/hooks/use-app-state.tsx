import { useState, useEffect, useMemo, createContext, useContext, type ReactNode } from 'react'
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
import { MOCK_VENUES, getSimulatedLocation } from '@/lib/mock-data'
import { US_EXPANSION_VENUES } from '@/lib/us-venues'
import {
  calculatePulseScore,
  getVenuesByProximity,
} from '@/lib/pulse-engine'
import { initHighContrast } from '@/lib/accessibility'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { useNotificationSettings } from '@/hooks/use-notification-settings'
import { useCurrentTime } from '@/hooks/use-current-time'
import { useRealtimeLocation } from '@/hooks/use-realtime-location'
import { useVenueSurgeTracker } from '@/hooks/use-venue-surge-tracker'
import { createEvent } from '@/lib/events'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { initializeSeededHashtags, applyHashtagDecay } from '@/lib/seeded-hashtags'
import { calculateScoreVelocity } from '@/lib/venue-trending'
import { getPendingCount, processQueue, registerConnectivityListeners, isOnline } from '@/lib/offline-queue'
import { fetchEventsFromApi, fetchPulsesFromApi, postEventToApi, syncQueuedPulseToApi } from '@/lib/server-api'
import { trackEvent, trackPerformance } from '@/lib/analytics'
import { toast } from 'sonner'
import type { TabId } from '@/components/BottomNav'

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
  currentTime: Date

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
}

const AppStateContext = createContext<AppState | null>(null)

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
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
  const currentTime = useCurrentTime()
  const { location: realtimeLocation, error: locationError, isTracking } = useRealtimeLocation({
    enableHighAccuracy: true,
    distanceFilter: 0.001,
  })

  const [currentUser, setCurrentUser] = useKV<User>('currentUser', {
    id: 'user-1',
    username: 'kyle',
    profilePhoto: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop',
    friends: ['user-2', 'user-3', 'user-4'],
    favoriteVenues: [],
    followedVenues: [],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    venueCheckInHistory: {},
    credibilityScore: 1.0,
    presenceSettings: { enabled: true, visibility: 'everyone', hideAtSensitiveVenues: true },
  })

  const launchedCitySet = new Set(
    (import.meta.env.VITE_LAUNCHED_CITIES ?? '')
      .split(',')
      .map((city: string) => city.trim().toLowerCase())
      .filter(Boolean)
  )
  const initialVenues = [...MOCK_VENUES, ...US_EXPANSION_VENUES].filter((venue) => {
    if (launchedCitySet.size === 0) return true
    return launchedCitySet.has((venue.city ?? '').toLowerCase())
  })

  const [pulses, setPulses] = useKV<Pulse[]>('pulses', [])
  const [venues, setVenues] = useKV<Venue[]>('venues', initialVenues)
  const [notifications, setNotifications] = useKV<Notification[]>('notifications', [])
  const [hashtags, setHashtags] = useKV<Hashtag[]>('hashtags', [])
  const [stories, setStories] = useKV<PulseStory[]>('stories', [])
  const [events, setEvents] = useKV<VenueEvent[]>('events', [])
  const [crews, setCrews] = useKV<Crew[]>('crews', [])
  const [crewCheckIns, setCrewCheckIns] = useKV<CrewCheckIn[]>('crewCheckIns', [])
  const [playlists, setPlaylists] = useKV<PulsePlaylist[]>('playlists', [])
  const [promotions, setPromotions] = useKV<PromotedVenue[]>('promotions', [])
  const [contentReports, setContentReports] = useKV<ContentReport[]>('contentReports', [])
  const [userBlocks] = useKV<UserBlock[]>('userBlocks', [])
  const [userMutes] = useKV<UserMute[]>('userMutes', [])

  // ── Side-effects ─────────────────────────────────────────
  useEffect(() => {
    if (!hashtags || hashtags.length === 0) setHashtags(initializeSeededHashtags())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const update = () => setQueuedPulseCount(getPendingCount())
    update()
    const id = setInterval(update, 3000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { initHighContrast() }, [])

  // Seed demo events / promotions
  useEffect(() => {
    if (!events || events.length === 0) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues])

  // Remote data sync
  useEffect(() => {
    let mounted = true
    if (events && events.length > 0) return
    fetchEventsFromApi().then(r => { if (mounted && r?.length) setEvents(r) })
    return () => { mounted = false }
  }, [events, setEvents])

  useEffect(() => {
    let mounted = true
    if (pulses && pulses.length > 0) return
    fetchPulsesFromApi().then(r => { if (mounted && r?.length) setPulses(r) })
    return () => { mounted = false }
  }, [pulses, setPulses])

  // Offline queue sync
  useEffect(() => {
    const syncCallback = async () => {
      const result = await processQueue(
        async (queuedPulse) => syncQueuedPulseToApi({ id: queuedPulse.id, venueId: queuedPulse.venueId, energyRating: queuedPulse.energyRating, caption: queuedPulse.caption, photos: queuedPulse.photos, hashtags: queuedPulse.hashtags }),
        {
          onItemAttempt: (pulse) => { trackEvent({ type: 'performance', timestamp: Date.now(), metric: 'queue_sync_attempt', value: pulse.retryCount, unit: 'retry_count' }) },
          onItemResult: (_pulse, success, elapsedMs) => { trackPerformance(success ? 'queue_sync_success_ms' : 'queue_sync_failure_ms', elapsedMs) },
          onBatchComplete: ({ synced, failed, total, elapsedMs }) => {
            trackPerformance('queue_sync_batch_ms', elapsedMs)
            trackEvent({ type: 'performance', timestamp: Date.now(), metric: 'queue_sync_batch_result', value: total > 0 ? synced / total : 1, unit: 'success_ratio' })
            if (failed > 0) toast.warning(`${failed} queued pulse${failed > 1 ? 's' : ''} still pending sync`)
          },
        }
      )
      setQueuedPulseCount(getPendingCount())
      if (result.synced > 0) toast.success(`Synced ${result.synced} queued pulse${result.synced > 1 ? 's' : ''}`)
    }
    if (isOnline() && getPendingCount() > 0) syncCallback()
    return registerConnectivityListeners(syncCallback, () => { toast.message('You are offline. New pulses will queue locally.') })
  }, [])

  // Location
  const userLocation = useMemo(
    () => realtimeLocation ? { lat: realtimeLocation.lat, lng: realtimeLocation.lng } : simulatedLocation,
    [realtimeLocation, simulatedLocation]
  )

  useVenueSurgeTracker(venues || [], userLocation, notificationSettings?.trendingVenues ?? true)

  useEffect(() => {
    if (!realtimeLocation && !simulatedLocation && !locationPermissionDenied) {
      const timer = setTimeout(() => {
        if (!realtimeLocation) getSimulatedLocation().then(pos => setSimulatedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [realtimeLocation, simulatedLocation, locationPermissionDenied])

  useEffect(() => {
    if (userLocation) {
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${userLocation.lat}&lon=${userLocation.lng}&format=json`)
        .then(res => res.json())
        .then(data => {
          const city = data.address?.city || data.address?.town || data.address?.village || 'New York'
          const state = data.address?.state || 'NY'
          setLocationName(`${city}, ${state}`)
        })
        .catch(() => setLocationName('New York, NY'))
    }
  }, [userLocation])

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
  useEffect(() => {
    const interval = setInterval(() => {
      setVenues((current) => {
        if (!current || !pulses) return current || []
        return current.map((venue) => {
          const venuePulses = pulses.filter(p => p.venueId === venue.id)
          const score = calculatePulseScore(venuePulses)
          const velocity = calculateScoreVelocity(venue, venuePulses)
          const lastPulse = venuePulses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          return { ...venue, pulseScore: score, scoreVelocity: velocity, lastPulseAt: lastPulse?.createdAt }
        })
      })
      setHashtags((current) => { if (!current) return []; return applyHashtagDecay(current) })
    }, 5000)
    return () => clearInterval(interval)
  }, [pulses, setVenues, setHashtags])

  // ── Derived values ───────────────────────────────────────
  const moderatedPulses = filterModeratedPulses(pulses || [], currentUser?.id || '', userBlocks || [], userMutes || [])
  const unreadNotificationCount = (notifications || []).filter(n => !n.read).length

  const sortedVenues = userLocation
    ? getVenuesByProximity(venues || [], userLocation.lat, userLocation.lng)
    : [...(venues || [])].sort((a, b) => b.pulseScore - a.pulseScore)

  const favoriteVenues = (currentUser?.favoriteVenues || [])
    .map(id => (venues || []).find(v => v.id === id))
    .filter((v): v is Venue => v !== undefined)

  const followedVenues = (currentUser?.followedVenues || [])
    .map(id => (venues || []).find(v => v.id === id))
    .filter((v): v is Venue => v !== undefined)

  const isFavorite = (venueId: string) => currentUser?.favoriteVenues?.includes(venueId) || false
  const isFollowed = (venueId: string) => currentUser?.followedVenues?.includes(venueId) || false

  const getPulsesWithUsers = (): PulseWithUser[] => {
    if (!currentUser || !venues) return []
    return moderatedPulses
      .map(pulse => ({ ...pulse, user: currentUser, venue: (venues || []).find(v => v.id === pulse.venueId)! }))
      .filter(p => p.venue)
  }

  const value: AppState = {
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
    userLocation, locationName, locationError, isTracking,
    realtimeLocation, locationPermissionDenied, setLocationPermissionDenied,
    simulatedLocation, setSimulatedLocation,
    unitSystem, notificationSettings, currentTime,
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
    unreadNotificationCount, isFavorite, isFollowed, getPulsesWithUsers,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
