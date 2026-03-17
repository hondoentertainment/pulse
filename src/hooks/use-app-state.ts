import { useState, useEffect, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import {
  Venue,
  Pulse,
  User,
  Notification,
  Hashtag,
  COOLDOWN_MINUTES,
} from '@/lib/types'
import type { TabId } from '@/components/BottomNav'
import { MOCK_VENUES, getSimulatedLocation } from '@/lib/mock-data'
import { US_EXPANSION_VENUES } from '@/lib/us-venues'
import { calculatePulseScore } from '@/lib/pulse-engine'
import { initHighContrast } from '@/lib/accessibility'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { useNotificationSettings } from '@/hooks/use-notification-settings'
import { useCurrentTime } from '@/hooks/use-current-time'
import { useRealtimeLocation } from '@/hooks/use-realtime-location'
import { useVenueSurgeTracker } from '@/hooks/use-venue-surge-tracker'
import { PulseStory } from '@/lib/stories'
import { VenueEvent, createEvent } from '@/lib/events'
import { Crew, CrewCheckIn } from '@/lib/crew-mode'
import { PulsePlaylist } from '@/lib/playlists'
import { PromotedVenue, createPromotedVenue } from '@/lib/promoted-discoveries'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { trackEvent, trackFunnelStep, recordSessionVenueView } from '@/lib/analytics'
import { addBreadcrumb } from '@/lib/error-tracking'
import { toast } from 'sonner'
import { initializeSeededHashtags, applyHashtagDecay } from '@/lib/seeded-hashtags'
import { calculateScoreVelocity } from '@/lib/venue-trending'

export type SubPage = 'events' | 'crews' | 'achievements' | 'insights' | 'neighborhoods' | 'playlists' | 'settings' | 'integrations' | 'challenges' | 'my-tickets' | 'night-planner' | null

export const ALL_USERS: User[] = [
  { id: 'user-2', username: 'sarah_j', profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
  { id: 'user-3', username: 'mike_v', profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
  { id: 'user-4', username: 'alex_k', profilePhoto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
  { id: 'user-5', username: 'jess_m', profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', friends: [], createdAt: new Date().toISOString() },
  { id: 'user-6', username: 'tom_b', profilePhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', friends: [], createdAt: new Date().toISOString() },
]

export function useAppState() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useKV<boolean>('hasCompletedOnboarding', false)
  const [activeTab, setActiveTab] = useState<TabId>('map')
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
  const integrationsEnabled = isFeatureEnabled('integrations')
  const socialDashboardEnabled = isFeatureEnabled('socialDashboard')
  const { unitSystem } = useUnitPreference()
  const { settings: notificationSettings } = useNotificationSettings()
  const currentTime = useCurrentTime()
  const { location: realtimeLocation, error: locationError, isTracking } = useRealtimeLocation({
    enableHighAccuracy: true,
    distanceFilter: 0.001
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
    presenceSettings: {
      enabled: true,
      visibility: 'everyone',
      hideAtSensitiveVenues: true
    }
  })

  const [pulses, setPulses] = useKV<Pulse[]>('pulses', [])
  const [venues, setVenues] = useKV<Venue[]>('venues', [...MOCK_VENUES, ...US_EXPANSION_VENUES])
  const [notifications, setNotifications] = useKV<Notification[]>('notifications', [])
  const [hashtags, setHashtags] = useKV<Hashtag[]>('hashtags', [])
  const [stories, setStories] = useKV<PulseStory[]>('stories', [])
  const [events, setEvents] = useKV<VenueEvent[]>('events', [])
  const [crews, setCrews] = useKV<Crew[]>('crews', [])
  const [crewCheckIns, setCrewCheckIns] = useKV<CrewCheckIn[]>('crewCheckIns', [])
  const [playlists, setPlaylists] = useKV<PulsePlaylist[]>('playlists', [])
  const [promotions, setPromotions] = useKV<PromotedVenue[]>('promotions', [])
  const [integrationVenue, setIntegrationVenue] = useState<Venue | null>(null)
  const [simulatedLocation, setSimulatedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)

  // Initialize seeded hashtags
  useEffect(() => {
    if (!hashtags || hashtags.length === 0) {
      setHashtags(initializeSeededHashtags())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initialize high contrast accessibility
  useEffect(() => {
    initHighContrast()
  }, [])

  // Seed demo events if empty
  useEffect(() => {
    if (!events || events.length === 0) {
      if (venues && venues.length > 0) {
        const now = new Date()
        const demoEvents: VenueEvent[] = [
          createEvent(
            venues[0].id, 'user-2', 'Friday Night DJ Set',
            'Live DJ spinning house & techno all night', 'dj_set',
            new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
            new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString(),
          ),
          createEvent(
            venues[1]?.id || venues[0].id, 'user-3', 'Trivia Tuesday',
            'Test your knowledge — prizes for top 3 teams!', 'trivia',
            new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
            new Date(now.getTime() + 27 * 60 * 60 * 1000).toISOString(),
          ),
          createEvent(
            venues[2]?.id || venues[0].id, 'user-4', 'Happy Hour Special',
            '$5 cocktails and half-price apps', 'happy_hour',
            new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
          ),
        ]
        setEvents(demoEvents)
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

  const userLocation = useMemo(
    () => realtimeLocation
      ? { lat: realtimeLocation.lat, lng: realtimeLocation.lng }
      : simulatedLocation,
    [realtimeLocation, simulatedLocation]
  )

  useVenueSurgeTracker(
    venues || [],
    userLocation,
    notificationSettings?.trendingVenues ?? true
  )

  // Fallback to simulated location
  useEffect(() => {
    if (!realtimeLocation && !simulatedLocation && !locationPermissionDenied) {
      const timer = setTimeout(() => {
        if (!realtimeLocation) {
          getSimulatedLocation().then((pos) => {
            setSimulatedLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            })
          })
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [realtimeLocation, simulatedLocation, locationPermissionDenied])

  // Reverse geocode user location
  useEffect(() => {
    if (userLocation) {
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${userLocation.lat}&lon=${userLocation.lng}&format=json`)
        .then(res => res.json())
        .then(data => {
          const city = data.address?.city || data.address?.town || data.address?.village || 'New York'
          const state = data.address?.state || 'NY'
          setLocationName(`${city}, ${state}`)
        })
        .catch(() => {
          setLocationName('New York, NY')
        })
    }
  }, [userLocation])

  // Handle location errors
  useEffect(() => {
    if (locationError) {
      if (locationError.includes('denied')) {
        setLocationPermissionDenied(true)
        toast.error('Location Access Needed', {
          description: 'Grant location permission to see venues near you',
          duration: 5000
        })
      } else {
        toast.error('Location Error', {
          description: locationError,
          duration: 3000
        })
      }
    }
  }, [locationError])

  // Track venue views
  useEffect(() => {
    if (selectedVenue) {
      const source = activeTab === 'map'
        ? 'map'
        : activeTab === 'discover'
          ? 'search'
          : activeTab === 'notifications'
            ? 'notification'
            : 'trending'
      trackEvent({ type: 'venue_view', timestamp: Date.now(), venueId: selectedVenue.id, source })
      trackFunnelStep('venue_view')
      recordSessionVenueView()
      addBreadcrumb('navigation', `Viewed venue: ${selectedVenue.name}`, { venueId: selectedVenue.id, source })
    }
  }, [selectedVenue, activeTab])

  // Periodic score recalculation
  useEffect(() => {
    const interval = setInterval(() => {
      setVenues((currentVenues) => {
        if (!currentVenues || !pulses) return currentVenues || []
        return currentVenues.map((venue) => {
          const venuePulses = pulses.filter((p) => p.venueId === venue.id)
          const score = calculatePulseScore(venuePulses)
          const velocity = calculateScoreVelocity(venue, venuePulses)
          const lastPulse = venuePulses.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0]

          return {
            ...venue,
            pulseScore: score,
            scoreVelocity: velocity,
            lastPulseAt: lastPulse?.createdAt
          }
        })
      })

      setHashtags((currentHashtags) => {
        if (!currentHashtags) return []
        return applyHashtagDecay(currentHashtags)
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [pulses, setVenues, setHashtags])

  const unreadNotificationCount = (notifications || []).filter((n) => !n.read).length

  return {
    // Onboarding
    hasCompletedOnboarding,
    setHasCompletedOnboarding,

    // Navigation
    activeTab,
    setActiveTab,
    subPage,
    setSubPage,

    // Venue selection
    selectedVenue,
    setSelectedVenue,
    presenceSheetOpen,
    setPresenceSheetOpen,

    // Story viewer
    storyViewerOpen,
    setStoryViewerOpen,
    storyViewerStories,
    setStoryViewerStories,

    // Pulse creation dialog
    createDialogOpen,
    setCreateDialogOpen,
    venueForPulse,
    setVenueForPulse,

    // Location
    locationName,
    userLocation,
    realtimeLocation,
    locationPermissionDenied,
    isTracking,
    simulatedLocation,
    setSimulatedLocation,

    // Admin
    showAdminDashboard,
    setShowAdminDashboard,
    trendingSubTab,
    setTrendingSubTab,

    // Feature flags
    integrationsEnabled,
    socialDashboardEnabled,

    // Settings
    unitSystem,
    notificationSettings,
    currentTime,

    // Core data
    currentUser,
    setCurrentUser,
    pulses,
    setPulses,
    venues,
    setVenues,
    notifications,
    setNotifications,
    hashtags,
    setHashtags,
    stories,
    setStories,
    events,
    setEvents,
    crews,
    setCrews,
    crewCheckIns,
    setCrewCheckIns,
    playlists,
    setPlaylists,
    promotions,
    setPromotions,
    integrationVenue,
    setIntegrationVenue,

    // Derived
    unreadNotificationCount,
  }
}

export type AppState = ReturnType<typeof useAppState>
