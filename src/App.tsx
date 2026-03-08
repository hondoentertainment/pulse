import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import {
  Venue,
  Pulse,
  User,
  EnergyRating,
  Notification,
  GroupedNotification,
  Hashtag,
  PulseWithUser,
  PresenceData
} from '@/lib/types'
import { calculatePresence } from '@/lib/presence-engine'
import { PresenceSheet } from '@/components/PresenceSheet'
import { BottomNav } from '@/components/BottomNav'
import { VenueCard } from '@/components/VenueCard'
import { CreatePulseDialog } from '@/components/CreatePulseDialog'
import { InteractiveMap } from '@/components/InteractiveMap'
import { NotificationFeed } from '@/components/NotificationFeed'
import { SplashScreen } from '@/components/SplashScreen'
import { VenuePage } from '@/components/VenuePage'
import { TrendingTab } from '@/components/TrendingTab'
import { ProfileTab } from '@/components/ProfileTab'
import { AppHeader } from '@/components/AppHeader'
import { SocialPulseDashboard } from '@/components/SocialPulseDashboard'
import { Input } from '@/components/ui/input'
import { Plus, MagnifyingGlass } from '@phosphor-icons/react'
import { MOCK_VENUES, getSimulatedLocation } from '@/lib/mock-data'
import {
  calculatePulseScore,
  getVenuesByProximity,
  canPostPulse
} from '@/lib/pulse-engine'
import { calculateUserCredibility } from '@/lib/credibility'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { useNotificationSettings } from '@/hooks/use-notification-settings'
import { useCurrentTime } from '@/hooks/use-current-time'
import { useRealtimeLocation } from '@/hooks/use-realtime-location'
import { useVenueSurgeTracker } from '@/hooks/use-venue-surge-tracker'

import { COOLDOWN_MINUTES } from '@/lib/types'
import { toast, Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { initializeSeededHashtags, applyHashtagDecay, updateHashtagUsage } from '@/lib/seeded-hashtags'
import { updateVenueWithCheckIn, calculateScoreVelocity } from '@/lib/venue-trending'

function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useKV<boolean>('hasCompletedOnboarding', false)
  const [activeTab, setActiveTab] = useState<'trending' | 'venues' | 'map' | 'notifications' | 'profile'>('map')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [presenceSheetOpen, setPresenceSheetOpen] = useState(false)

  // Mock users for presence simulation
  const ALL_USERS: User[] = [
    { id: 'user-2', username: 'sarah_j', profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
    { id: 'user-3', username: 'mike_v', profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
    { id: 'user-4', username: 'alex_k', profilePhoto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop', friends: ['user-1'], createdAt: new Date().toISOString() },
    { id: 'user-5', username: 'jess_m', profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', friends: [], createdAt: new Date().toISOString() },
    { id: 'user-6', username: 'tom_b', profilePhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', friends: [], createdAt: new Date().toISOString() },
  ]
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [venueForPulse, setVenueForPulse] = useState<Venue | null>(null)
  const [locationName, setLocationName] = useState<string>('')
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [venueSearchQuery, setVenueSearchQuery] = useState('')
  const [trendingSubTab, setTrendingSubTab] = useState<'trending' | 'my-spots'>('trending')
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
  const [venues, setVenues] = useKV<Venue[]>('venues', MOCK_VENUES)
  const [notifications, setNotifications] = useKV<Notification[]>('notifications', [])
  const [hashtags, setHashtags] = useKV<Hashtag[]>('hashtags', [])
  const [simulatedLocation, setSimulatedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)

  useEffect(() => {
    if (!hashtags || hashtags.length === 0) {
      setHashtags(initializeSeededHashtags())
    }
  }, [])

  const userLocation = realtimeLocation
    ? { lat: realtimeLocation.lat, lng: realtimeLocation.lng }
    : simulatedLocation

  useVenueSurgeTracker(
    venues || [],
    userLocation,
    notificationSettings?.trendingVenues ?? true
  )

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

  const handleCreatePulse = (venueId: string) => {
    if (!venues || !currentUser || !pulses) return
    const venue = venues.find((v) => v.id === venueId)
    if (!venue) return

    const userPulses = pulses.filter((p) => p.userId === currentUser.id)
    const cooldownCheck = canPostPulse(venueId, userPulses, COOLDOWN_MINUTES)

    if (!cooldownCheck.canPost) {
      toast.error('Cooldown active', {
        description: `Wait ${cooldownCheck.remainingMinutes}m before posting here again`
      })
      return
    }

    setVenueForPulse(venue)
    setCreateDialogOpen(true)
  }

  const handleSubmitPulse = async (data: {
    energyRating: EnergyRating
    caption: string
    photos: string[]
    video?: string
    hashtags?: string[]
  }) => {
    if (!venueForPulse || !currentUser || !venues) return

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 90 * 60 * 1000)

    const previousScore = venueForPulse.pulseScore

    const userCredibility = calculateUserCredibility(currentUser, pulses || [])

    const newPulse: Pulse = {
      id: `pulse-${Date.now()}`,
      userId: currentUser.id,
      venueId: venueForPulse.id,
      photos: data.photos,
      video: data.video,
      energyRating: data.energyRating,
      caption: data.caption,
      hashtags: data.hashtags || [],
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      reactions: {
        fire: [],
        eyes: [],
        skull: [],
        lightning: []
      },
      views: 0,
      isPending: true,
      credibilityWeight: userCredibility
    }

    setPulses((current) => {
      if (!current) return [newPulse]
      return [newPulse, ...current]
    })

    if (data.hashtags && data.hashtags.length > 0) {
      setHashtags((currentHashtags) => {
        if (!currentHashtags) return []
        return currentHashtags.map(tag => {
          if (data.hashtags!.includes(tag.name)) {
            return updateHashtagUsage(tag, true)
          }
          return tag
        })
      })
    }

    setVenues((currentVenues) => {
      if (!currentVenues) return []
      return currentVenues.map(v =>
        v.id === venueForPulse.id ? updateVenueWithCheckIn(v, newPulse) : v
      )
    })

    setCurrentUser((user) => {
      if (!user) {
        return {
          id: 'user-1',
          username: 'nightowl',
          profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl',
          friends: [],
          favoriteVenues: [],
          followedVenues: [],
          createdAt: new Date().toISOString(),
          venueCheckInHistory: {
            [venueForPulse.id]: 1
          }
        }
      }
      const checkInHistory = user.venueCheckInHistory || {}
      return {
        ...user,
        venueCheckInHistory: {
          ...checkInHistory,
          [venueForPulse.id]: (checkInHistory[venueForPulse.id] || 0) + 1
        }
      }
    })

    toast.success('Pulse posted!', {
      description: `Your vibe at ${venueForPulse.name} is live`
    })

    setTimeout(() => {
      setPulses((current) => {
        if (!current) return []
        return current.map((p) =>
          p.id === newPulse.id ? { ...p, isPending: false } : p
        )
      })

      const updatedVenuePulses = [...(pulses || []), newPulse].filter((p) => p.venueId === venueForPulse.id)
      const newScore = calculatePulseScore(updatedVenuePulses)

      if (notificationSettings?.friendPulses && currentUser.friends.length > 0) {
        const friendNotification: Notification = {
          id: `notif-${Date.now()}`,
          type: 'friend_pulse',
          userId: currentUser.id,
          pulseId: newPulse.id,
          venueId: venueForPulse.id,
          createdAt: now.toISOString(),
          read: false
        }

        setNotifications((current) => {
          if (!current) return [friendNotification]
          return [friendNotification, ...current]
        })
      }

      if ((previousScore < 50 && newScore >= 50) || (previousScore < 75 && newScore >= 75)) {
        const impactNotification: Notification = {
          id: `notif-impact-${Date.now()}`,
          type: 'impact',
          userId: currentUser.id,
          pulseId: newPulse.id,
          venueId: venueForPulse.id,
          energyThreshold: newScore >= 75 ? 'electric' : 'buzzing',
          createdAt: now.toISOString(),
          read: false
        }

        setNotifications((current) => {
          if (!current) return [impactNotification]
          return [impactNotification, ...current]
        })

        const thresholdLabel = newScore >= 75 ? 'Electric ⚡' : 'Buzzing 🔥'
        toast.success('You moved the needle!', {
          description: `Your pulse pushed ${venueForPulse.name} into ${thresholdLabel}`,
          duration: 5000
        })
      }
    }, 1500)
  }

  const handleReaction = (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => {
    if (!currentUser) return
    setPulses((current) => {
      if (!current) return []
      return current.map((p) => {
        if (p.id !== pulseId) return p

        const currentReactions = p.reactions[type]
        const hasReacted = currentReactions.includes(currentUser.id)

        return {
          ...p,
          reactions: {
            ...p.reactions,
            [type]: hasReacted
              ? currentReactions.filter(id => id !== currentUser.id)
              : [...currentReactions, currentUser.id]
          }
        }
      })
    })
  }

  const handleNotificationClick = (notification: GroupedNotification) => {
    if (notification.type === 'friend_pulse' || notification.type === 'pulse_reaction') {
      if (notification.venue) {
        setSelectedVenue(notification.venue)
      }
    } else if (notification.type === 'trending_venue' || notification.type === 'friend_nearby') {
      if (notification.venue) {
        setSelectedVenue(notification.venue)
      }
    }
    setActiveTab('trending')
  }

  const unreadNotificationCount = (notifications || []).filter((n) => !n.read).length


  const getPulsesWithUsers = (): PulseWithUser[] => {
    if (!pulses || !currentUser || !venues) return []
    return pulses.map((pulse) => ({
      ...pulse,
      user: currentUser,
      venue: venues.find((v) => v.id === pulse.venueId)!
    })).filter(p => p.venue)
  }

  const handleSplashComplete = () => {
    setHasCompletedOnboarding(true)
  }

  const handleToggleFavorite = (venueId: string) => {
    setCurrentUser((user) => {
      if (!user) return {
        id: 'user-1',
        username: 'nightowl',
        profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl',
        friends: [],
        favoriteVenues: [venueId],
        followedVenues: [],
        createdAt: new Date().toISOString()
      }
      const favorites = user.favoriteVenues || []
      const isFavorite = favorites.includes(venueId)

      if (isFavorite) {
        toast.success('Removed from favorites')
        return {
          ...user,
          favoriteVenues: favorites.filter((id) => id !== venueId)
        }
      } else {
        if (favorites.length >= 4) {
          toast.error('Maximum 4 favorites', {
            description: 'Remove one to add another'
          })
          return user
        }
        toast.success('Added to favorites')
        return {
          ...user,
          favoriteVenues: [...favorites, venueId]
        }
      }
    })
  }

  const handleToggleFollow = (venueId: string) => {
    setCurrentUser((user) => {
      if (!user) return {
        id: 'user-1',
        username: 'nightowl',
        profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl',
        friends: [],
        favoriteVenues: [],
        followedVenues: [venueId],
        createdAt: new Date().toISOString()
      }
      const followed = user.followedVenues || []
      const isFollowing = followed.includes(venueId)

      if (isFollowing) {
        toast.success('Unfollowed venue')
        return {
          ...user,
          followedVenues: followed.filter((id) => id !== venueId)
        }
      } else {
        if (followed.length >= 10) {
          toast.error('Maximum 10 followed venues', {
            description: 'Unfollow one to add another'
          })
          return user
        }
        toast.success('Following venue')
        return {
          ...user,
          followedVenues: [...followed, venueId]
        }
      }
    })
  }

  if (hasCompletedOnboarding === false) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  if (!venues || !currentUser || !pulses) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  }

  if (showAdminDashboard) {
    return (
      <SocialPulseDashboard
        venues={venues}
        pulses={pulses}
        onBack={() => setShowAdminDashboard(false)}
      />
    )
  }

  const sortedVenues = userLocation
    ? getVenuesByProximity(venues, userLocation.lat, userLocation.lng)
    : [...venues].sort((a, b) => b.pulseScore - a.pulseScore)

  const trendingVenues = [...venues].sort((a, b) => b.pulseScore - a.pulseScore)

  const favoriteVenues = (currentUser?.favoriteVenues || [])
    .map((id) => venues.find((v) => v.id === id))
    .filter((v): v is Venue => v !== undefined)

  const followedVenues = (currentUser?.followedVenues || [])
    .map((id) => venues.find((v) => v.id === id))
    .filter((v): v is Venue => v !== undefined)

  const isFollowed = (venueId: string) => {
    return currentUser?.followedVenues?.includes(venueId) || false
  }

  const isFavorite = (venueId: string) => {
    return currentUser?.favoriteVenues?.includes(venueId) || false
  }

  if (selectedVenue) {
    const venuePulses = getPulsesWithUsers().filter((p) => p.venueId === selectedVenue.id)
    const distance = userLocation
      ? calculateDistance(
        userLocation.lat,
        userLocation.lng,
        selectedVenue.location.lat,
        selectedVenue.location.lng
      )
      : undefined

    const presenceData = calculatePresence(selectedVenue.id, {
      currentUser,
      allUsers: ALL_USERS,
      allPulses: pulses || [],
      venueLocation: selectedVenue.location,
      userLocations: {
        'user-2': { lat: selectedVenue.location.lat + 0.00001, lng: selectedVenue.location.lng - 0.00001, lastUpdate: new Date().toISOString() },
        'user-3': { lat: selectedVenue.location.lat - 0.00001, lng: selectedVenue.location.lng + 0.00001, lastUpdate: new Date().toISOString() },
        'user-5': { lat: selectedVenue.location.lat + 0.00002, lng: selectedVenue.location.lng + 0.00002, lastUpdate: new Date().toISOString() }
      }
    })

    return (
      <>
        <Toaster position="top-center" theme="dark" />
        <VenuePage
          venue={selectedVenue}
          venuePulses={venuePulses}
          distance={distance}
          unitSystem={unitSystem}
          locationName={locationName}
          currentTime={currentTime}
          isTracking={isTracking}
          hasRealtimeLocation={!!realtimeLocation}
          isFavorite={isFavorite(selectedVenue.id)}
          isFollowed={isFollowed(selectedVenue.id)}
          currentUser={currentUser}
          presenceData={presenceData}
          onOpenPresence={() => setPresenceSheetOpen(true)}
          onBack={() => setSelectedVenue(null)}
          onCreatePulse={() => handleCreatePulse(selectedVenue.id)}
          onReaction={handleReaction}
          onToggleFavorite={() => handleToggleFavorite(selectedVenue.id)}
          onToggleFollow={() => handleToggleFollow(selectedVenue.id)}
        />
        <PresenceSheet
          open={presenceSheetOpen}
          onClose={() => setPresenceSheetOpen(false)}
          presence={presenceData}
          currentUser={currentUser}
          onUpdateSettings={(settings) => {
            setCurrentUser(prev => {
              if (!prev) return {
                id: 'user-1',
                username: 'nightowl',
                profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl',
                friends: [],
                favoriteVenues: [],
                followedVenues: [],
                createdAt: new Date().toISOString(),
                presenceSettings: settings
              }
              return { ...prev, presenceSettings: settings }
            })
          }}
        />
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} unreadNotifications={unreadNotificationCount} />
        <CreatePulseDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          venue={venueForPulse}
          onSubmit={handleSubmitPulse}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Toaster position="top-center" theme="dark" />
      <AppHeader
        locationName={locationName}
        isTracking={isTracking}
        hasRealtimeLocation={!!realtimeLocation}
        locationPermissionDenied={locationPermissionDenied}
        currentTime={currentTime}
      />

      <AnimatePresence mode="wait">
        {activeTab === 'trending' && (
          <motion.div
            key="trending"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TrendingTab
              venues={venues}
              pulses={pulses}
              pulsesWithUsers={getPulsesWithUsers()}
              favoriteVenues={favoriteVenues}
              followedVenues={followedVenues}
              userLocation={userLocation}
              unitSystem={unitSystem}
              currentUser={currentUser}
              trendingSubTab={trendingSubTab}
              onSubTabChange={setTrendingSubTab}
              onVenueClick={(venue) => setSelectedVenue(venue)}
              onToggleFavorite={handleToggleFavorite}
              onToggleFollow={handleToggleFollow}
              onReaction={handleReaction}
              isFavorite={isFavorite}
            />
          </motion.div>
        )}

        {activeTab === 'venues' && (
          <motion.div
            key="venues"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto px-4 py-6 space-y-6"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-bold">All Venues</h2>
              <p className="text-sm text-muted-foreground">
                Browse all venues sorted by distance
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <MagnifyingGlass
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  size={16}
                />
                <Input
                  placeholder="Search venues by name or category..."
                  value={venueSearchQuery}
                  onChange={(e) => setVenueSearchQuery(e.target.value)}
                  className="pl-9 bg-card/50 backdrop-blur-sm"
                />
              </div>

              <div className="space-y-3">
                {sortedVenues
                  .filter(venue => {
                    if (!venueSearchQuery) return true
                    const query = venueSearchQuery.toLowerCase()
                    return (
                      venue.name.toLowerCase().includes(query) ||
                      venue.category?.toLowerCase().includes(query)
                    )
                  })
                  .map((venue) => {
                    const distance = userLocation
                      ? calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        venue.location.lat,
                        venue.location.lng
                      )
                      : undefined
                    return (
                      <VenueCard
                        key={venue.id}
                        venue={venue}
                        distance={distance}
                        onClick={() => setSelectedVenue(venue)}
                        isFavorite={isFavorite(venue.id)}
                        onToggleFavorite={handleToggleFavorite}
                        isFollowed={isFollowed(venue.id)}
                        onToggleFollow={handleToggleFollow}
                      />
                    )
                  })}

                {sortedVenues.filter(venue =>
                  venue.name.toLowerCase().includes(venueSearchQuery.toLowerCase()) ||
                  venue.category?.toLowerCase().includes(venueSearchQuery.toLowerCase())
                ).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MagnifyingGlass size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No venues found matching "{venueSearchQuery}"</p>
                    </div>
                  )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'map' && (
          <motion.div
            key="map"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto px-4 py-6 h-[calc(100vh-180px)]"
          >
            <div className="h-full">
              <InteractiveMap
                venues={venues}
                userLocation={userLocation}
                onVenueClick={(venue) => setSelectedVenue(venue)}
                isTracking={isTracking}
                locationAccuracy={realtimeLocation?.accuracy}
              />
            </div>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <NotificationFeed
              currentUser={currentUser}
              pulses={pulses}
              venues={venues}
              onNotificationClick={handleNotificationClick}
            />
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ProfileTab
              currentUser={currentUser}
              pulses={pulses}
              pulsesWithUsers={getPulsesWithUsers()}
              favoriteVenues={favoriteVenues}
              onVenueClick={(venue) => setSelectedVenue(venue)}
              onReaction={handleReaction}
              onOpenSocialPulseDashboard={() => setShowAdminDashboard(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} unreadNotifications={unreadNotificationCount} />
      <CreatePulseDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        venue={venueForPulse}
        onSubmit={handleSubmitPulse}
      />

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (sortedVenues.length > 0) {
            handleCreatePulse(sortedVenues[0].id)
          }
        }}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/50 flex items-center justify-center z-40"
        style={{
          boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)'
        }}
      >
        <Plus size={28} weight="bold" />
      </motion.button>
    </div>
  )
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export default App
