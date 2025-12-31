import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Pulse, PulseWithUser, Venue, User, EnergyRating, Notification, GroupedNotification } from '@/lib/types'
import { BottomNav } from '@/components/BottomNav'
import { VenueCard } from '@/components/VenueCard'
import { PulseCard } from '@/components/PulseCard'
import { CreatePulseDialog } from '@/components/CreatePulseDialog'
import { InteractiveMap } from '@/components/InteractiveMap'
import { Settings } from '@/components/Settings'
import { NotificationFeed } from '@/components/NotificationFeed'
import { SplashScreen } from '@/components/SplashScreen'
import { Favorites } from '@/components/Favorites'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PulseScore } from '@/components/PulseScore'
import { Plus, MapPin, ArrowLeft, Clock, Star } from '@phosphor-icons/react'
import { MOCK_VENUES, getSimulatedLocation, SIMULATED_USER_LOCATION } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import {
  calculatePulseScore,
  getVenuesByProximity,
  formatTimeAgo,
  canPostPulse,
  isWithinRadius
} from '@/lib/pulse-engine'
import { formatDistance } from '@/lib/units'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { useNotificationSettings } from '@/hooks/use-notification-settings'
import { useCurrentTime } from '@/hooks/use-current-time'
import { useRealtimeLocation } from '@/hooks/use-realtime-location'
import { generateDemoNotifications } from '@/lib/demo-notifications'
import { COOLDOWN_MINUTES, CHECK_IN_RADIUS_MILES } from '@/lib/types'
import { toast, Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useKV<boolean>('hasCompletedOnboarding', false)
  const [activeTab, setActiveTab] = useState<'trending' | 'map' | 'notifications' | 'profile' | 'settings'>('map')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [venueForPulse, setVenueForPulse] = useState<Venue | null>(null)
  const [locationName, setLocationName] = useState<string>('')
  const { unitSystem } = useUnitPreference()
  const { settings: notificationSettings } = useNotificationSettings()
  const currentTime = useCurrentTime()
  const { location: realtimeLocation, error: locationError, isTracking } = useRealtimeLocation({
    enableHighAccuracy: true,
    distanceFilter: 0.001
  })

  const [currentUser, setCurrentUser] = useKV<User>('currentUser', {
    id: 'user-1',
    username: 'nightowl',
    profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl',
    friends: [],
    favoriteVenues: [],
    createdAt: new Date().toISOString()
  })

  const [pulses, setPulses] = useKV<Pulse[]>('pulses', [])
  const [venues, setVenues] = useKV<Venue[]>('venues', MOCK_VENUES)
  const [notifications, setNotifications] = useKV<Notification[]>('notifications', [])
  const [simulatedLocation, setSimulatedLocation] = useState<{ lat: number; lng: number } | null>(null)

  const userLocation = realtimeLocation 
    ? { lat: realtimeLocation.lat, lng: realtimeLocation.lng } 
    : simulatedLocation

  useEffect(() => {
    if (!realtimeLocation && !simulatedLocation) {
      getSimulatedLocation().then((pos) => {
        setSimulatedLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        })
      })
    }
  }, [realtimeLocation, simulatedLocation])

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
      toast.error('Location Error', {
        description: locationError
      })
    }
  }, [locationError])

  useEffect(() => {
    const interval = setInterval(() => {
      setVenues((currentVenues) => {
        if (!currentVenues || !pulses) return currentVenues || []
        return currentVenues.map((venue) => {
          const venuePulses = pulses.filter((p) => p.venueId === venue.id)
          const score = calculatePulseScore(venuePulses)
          const lastPulse = venuePulses.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0]
          
          return {
            ...venue,
            pulseScore: score,
            lastPulseAt: lastPulse?.createdAt
          }
        })
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [pulses, setVenues])

  const handleCreatePulse = (venueId: string) => {
    if (!venues || !userLocation || !currentUser || !pulses) return
    const venue = venues.find((v) => v.id === venueId)
    if (!venue) return

    if (!isWithinRadius(
      userLocation.lat,
      userLocation.lng,
      venue.location.lat,
      venue.location.lng,
      CHECK_IN_RADIUS_MILES
    )) {
      toast.error('Too far from venue', {
        description: 'You must be at the venue to create a pulse'
      })
      return
    }

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
  }) => {
    if (!venueForPulse || !currentUser) return

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 90 * 60 * 1000)

    const newPulse: Pulse = {
      id: `pulse-${Date.now()}`,
      userId: currentUser.id,
      venueId: venueForPulse.id,
      photos: data.photos,
      video: data.video,
      energyRating: data.energyRating,
      caption: data.caption,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      reactions: {
        fire: 0,
        eyes: 0,
        skull: 0,
        lightning: 0
      },
      views: 0
    }

    setPulses((current) => {
      if (!current) return [newPulse]
      return [newPulse, ...current]
    })

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

    toast.success('Pulse posted!', {
      description: `Your vibe at ${venueForPulse.name} is live`
    })
  }

  const handleReaction = (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => {
    setPulses((current) => {
      if (!current) return []
      return current.map((p) =>
        p.id === pulseId
          ? {
              ...p,
              reactions: {
                ...p.reactions,
                [type]: p.reactions[type] + 1
              }
            }
          : p
      )
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

  const handleGenerateDemoNotifications = () => {
    if (!currentUser || !venues) return
    
    const venueIds = venues.map((v) => v.id)
    const { notifications: demoNotifications, pulses: updatedPulses } = generateDemoNotifications(
      currentUser,
      pulses || [],
      venueIds
    )

    setNotifications((current) => {
      if (!current) return demoNotifications
      return [...demoNotifications, ...current]
    })

    setPulses(updatedPulses)

    toast.success('Demo notifications generated!', {
      description: `Added ${demoNotifications.length} sample notifications to your feed`
    })

    setActiveTab('notifications')
  }

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

  if (hasCompletedOnboarding === false) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  if (!venues || !currentUser || !pulses) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  }

  const sortedVenues = userLocation
    ? getVenuesByProximity(venues, userLocation.lat, userLocation.lng)
    : [...venues].sort((a, b) => b.pulseScore - a.pulseScore)

  const trendingVenues = [...venues].sort((a, b) => b.pulseScore - a.pulseScore)

  const favoriteVenues = (currentUser?.favoriteVenues || [])
    .map((id) => venues.find((v) => v.id === id))
    .filter((v): v is Venue => v !== undefined)

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

    return (
      <div className="min-h-screen bg-background pb-20">
        <Toaster position="top-center" theme="dark" />
        <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedVenue(null)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{selectedVenue.name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  {selectedVenue.category && (
                    <span className="font-mono uppercase">{selectedVenue.category}</span>
                  )}
                  {distance !== undefined && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <MapPin size={14} weight="fill" />
                        <span>{formatDistance(distance, unitSystem)} away</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleFavorite(selectedVenue.id)}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <Star
                    size={24}
                    weight={isFavorite(selectedVenue.id) ? 'fill' : 'regular'}
                    className={isFavorite(selectedVenue.id) ? 'text-accent' : 'text-muted-foreground'}
                  />
                </button>
                <PulseScore score={selectedVenue.pulseScore} size="sm" showLabel={false} />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground font-mono">
              {locationName && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} weight="fill" className={cn(
                    "transition-colors",
                    isTracking ? "text-accent animate-pulse" : "text-muted-foreground"
                  )} />
                  <span>{locationName}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Clock size={12} weight="fill" className="text-accent" />
                <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Live Energy</h2>
              {selectedVenue.lastPulseAt && (
                <p className="text-sm text-muted-foreground">
                  Last pulse {formatTimeAgo(selectedVenue.lastPulseAt)}
                </p>
              )}
            </div>
            <Button
              onClick={() => handleCreatePulse(selectedVenue.id)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus size={20} weight="bold" className="mr-2" />
              Create Pulse
            </Button>
          </div>

          <Separator />

          {venuePulses.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-lg text-muted-foreground">No pulses yet</p>
              <p className="text-sm text-muted-foreground">
                Be the first to capture the vibe here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {venuePulses.map((pulse) => (
                <PulseCard
                  key={pulse.id}
                  pulse={pulse}
                  onReaction={(type) => handleReaction(pulse.id, type)}
                />
              ))}
            </div>
          )}
        </div>

        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} unreadNotifications={unreadNotificationCount} />
        <CreatePulseDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          venue={venueForPulse}
          onSubmit={handleSubmitPulse}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Toaster position="top-center" theme="dark" />
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Pulse
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where the energy is — right now
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground font-mono">
            {locationName && (
              <div className="flex items-center gap-1.5">
                <MapPin size={14} weight="fill" className={cn(
                  "transition-colors",
                  isTracking ? "text-accent animate-pulse" : "text-muted-foreground"
                )} />
                <span>{locationName}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock size={14} weight="fill" className="text-accent" />
              <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'trending' && (
          <motion.div
            key="trending"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto px-4 py-6 space-y-6"
          >
            {favoriteVenues.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Star size={20} weight="fill" className="text-accent" />
                  <h2 className="text-xl font-bold">Favorites</h2>
                </div>
                <Favorites
                  favoriteVenues={favoriteVenues}
                  userLocation={userLocation}
                  unitSystem={unitSystem}
                  onVenueClick={(venue) => setSelectedVenue(venue)}
                  onToggleFavorite={handleToggleFavorite}
                />
              </div>
            )}

            {favoriteVenues.length > 0 && <Separator />}

            <div className="space-y-2">
              <h2 className="text-xl font-bold">Trending Near You</h2>
              <p className="text-sm text-muted-foreground">
                Live energy scores from venues around you
              </p>
            </div>

            {trendingVenues.filter((v) => v.pulseScore > 0).length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-accent text-accent-foreground animate-pulse-glow">
                    Just Popped
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Surging right now
                  </span>
                </div>
                {trendingVenues
                  .filter((v) => v.pulseScore >= 60)
                  .slice(0, 3)
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
                        isJustPopped
                        isFavorite={isFavorite(venue.id)}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    )
                  })}
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <h3 className="text-lg font-bold">All Venues</h3>
              {sortedVenues.map((venue) => {
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
                  />
                )
              })}
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
            className="max-w-2xl mx-auto px-4 py-6 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent p-1">
                <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                  <span className="text-2xl font-bold">{currentUser.username.slice(0, 2).toUpperCase()}</span>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{currentUser.username}</h2>
                <p className="text-sm text-muted-foreground">
                  {pulses.filter((p) => p.userId === currentUser.id).length} pulses
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Member since {new Date(currentUser.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            <Separator />

            {favoriteVenues.length > 0 && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Star size={20} weight="fill" className="text-accent" />
                    <h3 className="text-lg font-bold">Favorite Venues</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {favoriteVenues.map((venue) => {
                      const venuePulses = pulses.filter((p) => p.venueId === venue.id)
                      const latestPulse = venuePulses.sort(
                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )[0]
                      
                      return (
                        <button
                          key={venue.id}
                          onClick={() => setSelectedVenue(venue)}
                          className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-accent transition-all group"
                        >
                          {latestPulse?.photos?.[0] ? (
                            <img
                              src={latestPulse.photos[0]}
                              alt={venue.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-muted to-secondary flex items-center justify-center">
                              <MapPin size={24} weight="fill" className="text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                            <p className="text-xs font-bold text-white truncate">{venue.name}</p>
                          </div>
                          <div className="absolute top-1 right-1">
                            <PulseScore score={venue.pulseScore} size="xs" showLabel={false} />
                          </div>
                        </button>
                      )
                    })}
                    {Array.from({ length: Math.max(0, 4 - favoriteVenues.length) }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="aspect-square rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center"
                      >
                        <Star size={20} className="text-muted-foreground/50" />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />
              </>
            )}

            <div className="space-y-3">
              <h3 className="text-lg font-bold">Your Pulses</h3>
              {getPulsesWithUsers()
                .filter((p) => p.userId === currentUser.id)
                .map((pulse) => (
                  <PulseCard
                    key={pulse.id}
                    pulse={pulse}
                    onReaction={(type) => handleReaction(pulse.id, type)}
                  />
                ))}
              {pulses.filter((p) => p.userId === currentUser.id).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No pulses yet. Check into a venue to get started!
                </p>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Settings onGenerateDemoNotifications={handleGenerateDemoNotifications} />
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
