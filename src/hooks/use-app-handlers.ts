import {
  Venue,
  Pulse,
  User,
  EnergyRating,
  Notification,
  GroupedNotification,
  PulseWithUser,
  COOLDOWN_MINUTES,
} from '@/lib/types'
import type { TabId } from '@/components/BottomNav'
import { canPostPulse, calculatePulseScore } from '@/lib/pulse-engine'
import { calculateUserCredibility } from '@/lib/credibility'
import { checkUserRateLimit } from '@/lib/rate-limiter'
import { announce } from '@/lib/accessibility'
import { createStory, PulseStory } from '@/lib/stories'
import { trackEvent, trackFunnelStep, recordSessionPulse, recordSessionCheckin } from '@/lib/analytics'
import { addBreadcrumb } from '@/lib/error-tracking'
import { measureNavigation, endNavigation } from '@/lib/performance-monitor'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import { updateHashtagUsage } from '@/lib/seeded-hashtags'
import { updateVenueWithCheckIn } from '@/lib/venue-trending'
import type { AppState } from '@/hooks/use-app-state'

export function useAppHandlers(state: AppState) {
  const {
    activeTab,
    setActiveTab,
    setSelectedVenue,
    setSubPage,
    setCreateDialogOpen,
    venueForPulse,
    setVenueForPulse,
    setShowAdminDashboard,
    integrationsEnabled,
    socialDashboardEnabled,
    notificationSettings,
    currentUser,
    setCurrentUser,
    pulses,
    setPulses,
    venues,
    setVenues,
    setNotifications,
    setHashtags,
    setStories,
    setStoryViewerOpen,
    setStoryViewerStories,
    setIntegrationVenue,
    setSimulatedLocation,
  } = state

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

    const rateCheck = checkUserRateLimit(currentUser.id, 'pulse_create')
    if (!rateCheck.allowed) {
      toast.error('Slow down!', { description: `Try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s` })
      return
    }

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

    // Auto-create story from pulse
    const story = createStory(newPulse, currentUser, venueForPulse.name)
    setStories((current) => {
      if (!current) return [story]
      return [story, ...current]
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
    announce(`Pulse posted at ${venueForPulse.name}`)

    trackEvent({ type: 'pulse_submit', timestamp: Date.now(), venueId: venueForPulse.id, energyRating: data.energyRating, hasPhoto: data.photos.length > 0, hasCaption: !!data.caption, hashtagCount: data.hashtags?.length || 0 })
    trackFunnelStep('pulse_creation')
    recordSessionPulse()
    recordSessionCheckin()
    addBreadcrumb('action', 'Pulse submitted', { venueId: venueForPulse.id, venueName: venueForPulse.name })

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
    const reactionRate = checkUserRateLimit(currentUser.id, 'reaction')
    if (!reactionRate.allowed) return
    trackEvent({ type: 'pulse_reaction', timestamp: Date.now(), pulseId, reactionType: type })
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

  const handleAddFriend = (userId: string) => {
    if (!currentUser) return
    trackEvent({ type: 'friend_add', timestamp: Date.now(), method: 'suggestion' })
    setCurrentUser(prev => {
      if (!prev) return prev!
      if (prev.friends.includes(userId)) return prev
      return { ...prev, friends: [...prev.friends, userId] }
    })
    toast.success('Friend added!')
  }

  const handleStoryReact = (storyId: string, emoji: string) => {
    toast.success(`Reacted ${emoji}`)
  }

  const handleTabChange = (tab: TabId) => {
    // End previous navigation measurement (if any) before starting new one
    endNavigation()

    setActiveTab(tab)
    const tabLabels: Record<TabId, string> = {
      trending: 'Trending',
      discover: 'Discover',
      map: 'Map',
      notifications: 'Notifications',
      profile: 'Profile',
    }
    announce(`Switched to ${tabLabels[tab]} tab`)

    // Observability: breadcrumb + performance timing for route change
    addBreadcrumb('navigation', `Switched to ${tabLabels[tab]} tab`, { tab })
    measureNavigation(tab)
    logger.info(`Tab changed to ${tab}`, 'AppHandlers')

    // The navigation measurement will be ended on the next tab change or unmount.
    // For single-page apps without async route loading this is close enough;
    // a more precise measurement would use a useEffect after render.
    requestAnimationFrame(() => endNavigation())
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
      const isFav = favorites.includes(venueId)

      if (isFav) {
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

  const handleStoryClick = (storyList: PulseStory[]) => {
    setStoryViewerStories(storyList)
    setStoryViewerOpen(true)
  }

  const handleOpenIntegrations = (venue: Venue) => {
    if (!integrationsEnabled) {
      toast.error('Integrations are currently unavailable')
      return
    }
    setIntegrationVenue(venue)
    setSelectedVenue(null)
    setSubPage('integrations')
  }

  const handleOpenSocialPulseDashboard = () => {
    if (!socialDashboardEnabled) {
      toast.error('Admin dashboard is currently unavailable')
      return
    }
    setShowAdminDashboard(true)
  }

  const handleOpenOwnerDashboard = () => {
    if (!socialDashboardEnabled) {
      toast.error('Owner dashboard is currently unavailable')
      return
    }
    setShowAdminDashboard(true)
  }

  const handleCityChange = (loc: { lat: number; lng: number }) => {
    setSimulatedLocation(loc)
    toast.success('Location updated')
  }

  const getPulsesWithUsers = (): PulseWithUser[] => {
    if (!pulses || !currentUser || !venues) return []
    return pulses.map((pulse) => ({
      ...pulse,
      user: currentUser,
      venue: venues.find((v) => v.id === pulse.venueId)!
    })).filter(p => p.venue)
  }

  return {
    handleCreatePulse,
    handleSubmitPulse,
    handleReaction,
    handleNotificationClick,
    handleAddFriend,
    handleStoryReact,
    handleTabChange,
    handleToggleFavorite,
    handleToggleFollow,
    handleStoryClick,
    handleOpenIntegrations,
    handleOpenSocialPulseDashboard,
    handleOpenOwnerDashboard,
    handleCityChange,
    getPulsesWithUsers,
  }
}

export type AppHandlers = ReturnType<typeof useAppHandlers>
