import { queryClient } from '@/lib/query-client'
import { useNavigate } from 'react-router-dom'
import { useAppState, ALL_USERS } from '@/hooks/use-app-state'
import type { Pulse, EnergyRating, GroupedNotification } from '@/lib/types'
import type { ContentReport } from '@/lib/content-moderation'
import type { VenueEvent } from '@/lib/events'
import { PulseStory } from '@/lib/stories'
import { calculateUserCredibility } from '@/lib/credibility'
import { checkUserRateLimit, detectAbuse } from '@/lib/rate-limiter'
import { announce } from '@/lib/accessibility'
import {
  calculatePulseScore,
  canPostPulse,
} from '@/lib/pulse-engine'
import { COOLDOWN_MINUTES } from '@/lib/types'
import { toast } from 'sonner'
import { updateHashtagUsage } from '@/lib/seeded-hashtags'
import { updateVenueWithCheckIn } from '@/lib/venue-trending'

import { postEventToApi } from '@/lib/server-api'
import { uploadPulseToSupabase } from '@/lib/supabase-api'
import { trackEvent } from '@/lib/analytics'
import { isPromotionActive, recordImpression, recordClick } from '@/lib/promoted-discoveries'
import { createStory } from '@/lib/stories'
import { initiateCrewCheckIn, getUserCrews, getActiveCrewCheckIns } from '@/lib/crew-mode'
import type { TabId } from '@/components/BottomNav'

const TAB_TO_PATH: Record<TabId, string> = {
  trending: '/',
  discover: '/discover',
  map: '/map',
  notifications: '/notifications',
  profile: '/profile',
  video: '/video',
}

export function useAppHandlers() {
  const navigate = useNavigate()
  const state = useAppState()
  const {
    activeTab,
    venues,
    pulses,
    currentUser,
    setActiveTab,
    setSelectedVenue,
    setPulses,
    setVenues,
    setCurrentUser,
    setNotifications,
    setHashtags,
    setStories,
    setEvents,
    setCrews,
    setCrewCheckIns,
    setPlaylists,
    setPromotions,
    setContentReports,
    venueForPulse,
    setVenueForPulse,
    createDialogOpen,
    setCreateDialogOpen,
    notificationSettings,
    crewCheckIns,
    crews,
    setQueuedPulseCount,
    setSubPage,
    setIntegrationVenue,
    integrationsEnabled,
    socialDashboardEnabled,
    setShowAdminDashboard,
  } = state

  const handleCreatePulse = (venueId: string) => {
    if (!venues || !currentUser || !pulses) return
    const venue = venues.find(v => v.id === venueId)
    if (!venue) return

    const userPulses = pulses.filter(p => p.userId === currentUser.id)
    const cooldownCheck = canPostPulse(venueId, userPulses, COOLDOWN_MINUTES)
    if (!cooldownCheck.canPost) {
      toast.error('Cooldown active', { description: `Wait ${cooldownCheck.remainingMinutes}m before posting here again` })
      return
    }
    setVenueForPulse(venue)
    setCreateDialogOpen(true)
  }

  const handleSubmitPulse = async (data: { energyRating: EnergyRating; caption: string; photos: string[]; video?: string; hashtags?: string[] }) => {
    if (!venueForPulse || !currentUser || !venues) return

    const recentActions = (pulses || [])
      .filter(pulse => pulse.userId === currentUser.id)
      .map(pulse => ({ action: 'pulse_create', timestamp: new Date(pulse.createdAt).getTime(), metadata: { energyRating: pulse.energyRating } }))
    recentActions.push({ action: 'pulse_create', timestamp: Date.now(), metadata: { energyRating: data.energyRating } })

    const abuseSignals = detectAbuse(currentUser.id, recentActions)
    const highSeverity = abuseSignals.find(s => s.severity === 'high')
    if (highSeverity) { toast.error('Pulse blocked for safety checks', { description: highSeverity.description }); return }
    if (abuseSignals.some(s => s.severity === 'medium')) toast.warning('Unusual posting pattern detected', { description: 'Please keep pulses authentic to avoid temporary restrictions' })

    const rateCheck = checkUserRateLimit(currentUser.id, 'pulse_create')
    if (!rateCheck.allowed) { toast.error('Slow down!', { description: `Try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s` }); return }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 90 * 60 * 1000)
    const previousScore = venueForPulse.pulseScore
    const userCredibility = calculateUserCredibility(currentUser, pulses || [])
    const activeCrewCheckIns = getActiveCrewCheckIns(crewCheckIns || [], venueForPulse.id)
    const currentCrewCheckIn = activeCrewCheckIns.find(ci => ci.initiatorId === currentUser.id || ci.confirmations[currentUser.id])
    const today = now.toISOString().split('T')[0]
    const venuePulsesToday = (pulses || []).filter(p => p.venueId === venueForPulse.id && new Date(p.createdAt).toISOString().split('T')[0] === today)
    const isPioneer = venuePulsesToday.length === 0

    const newPulse = {
      id: `pulse-${Date.now()}`,
      userId: currentUser.id,
      venueId: venueForPulse.id,
      crewId: currentCrewCheckIn?.crewId,
      photos: data.photos,
      video: data.video,
      energyRating: data.energyRating,
      caption: data.caption,
      hashtags: data.hashtags || [],
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      reactions: { fire: [] as string[], eyes: [] as string[], skull: [] as string[], lightning: [] as string[] },
      views: 0,
      isPending: true,
      credibilityWeight: userCredibility,
      isPioneer,
    }

    setPulses(current => { if (!current) return [newPulse]; return [newPulse, ...current] })
    queryClient.setQueryData(['pulses'], (current: Pulse[] | undefined) => { if (!current) return [newPulse]; return [newPulse, ...current] })

    const story = createStory(newPulse, currentUser, venueForPulse.name)
    setStories(current => { if (!current) return [story]; return [story, ...current] })

    if (data.hashtags && data.hashtags.length > 0) {
      setHashtags(currentHashtags => {
        if (!currentHashtags) return []
        return currentHashtags.map(tag => data.hashtags!.includes(tag.name) ? updateHashtagUsage(tag, true) : tag)
      })
    }

    setVenues(currentVenues => {
      if (!currentVenues) return []
      return currentVenues.map(v => v.id === venueForPulse.id ? updateVenueWithCheckIn(v, newPulse) : v)
    })

    setCurrentUser(user => {
      if (!user) return { id: 'user-1', username: 'nightowl', profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl', friends: [], favoriteVenues: [], followedVenues: [], createdAt: new Date().toISOString(), venueCheckInHistory: { [venueForPulse.id]: 1 }, postStreak: 1, lastPostDate: today }
      let newStreak = user.postStreak || 0
      if (user.lastPostDate !== today) {
        if (user.lastPostDate) { const diff = Math.ceil(Math.abs(new Date(today).getTime() - new Date(user.lastPostDate).getTime()) / (1000 * 60 * 60 * 24)); newStreak = diff === 1 ? newStreak + 1 : 1 } else newStreak = 1
      }
      const history = user.venueCheckInHistory || {}
      return { ...user, venueCheckInHistory: { ...history, [venueForPulse.id]: (history[venueForPulse.id] || 0) + 1 }, postStreak: newStreak, lastPostDate: today }
    })

    if (isPioneer) toast.success('Pioneer! 🧗', { description: 'You dropped the first pulse here today.' })
    toast.success('Pulse posted!', { description: `Your vibe at ${venueForPulse.name} is live` })
    announce(`Pulse posted at ${venueForPulse.name}`)
    if (navigator.vibrate) navigator.vibrate([20, 50, 20])
    trackEvent({ type: 'pulse_submit', timestamp: Date.now(), venueId: venueForPulse.id, energyRating: data.energyRating, hasPhoto: data.photos.length > 0, hasCaption: !!data.caption, hashtagCount: data.hashtags?.length || 0 })

    const syncOnline = await uploadPulseToSupabase(newPulse)
    if (!syncOnline) {
      toast.message('Saved offline! The Service Worker will sync it when connection is restored.')
    }

    setPulses(current => { if (!current) return []; return current.map(p => p.id === newPulse.id ? { ...p, isPending: false, uploadError: false } : p) })

    const updatedVenuePulses = [...(pulses || []), newPulse].filter(p => p.venueId === venueForPulse.id)
    const newScore = calculatePulseScore(updatedVenuePulses)

    if (notificationSettings?.friendPulses && currentUser.friends.length > 0) {
      setNotifications(current => {
        const n = { id: `notif-${Date.now()}`, type: 'friend_pulse' as const, userId: currentUser.id, pulseId: newPulse.id, venueId: venueForPulse.id, createdAt: now.toISOString(), read: false }
        return current ? [n, ...current] : [n]
      })
    }

    if ((previousScore < 50 && newScore >= 50) || (previousScore < 75 && newScore >= 75)) {
      const thresholdLabel = newScore >= 75 ? 'Electric ⚡' : 'Buzzing 🔥'
      setNotifications(current => {
        const n = { id: `notif-impact-${Date.now()}`, type: 'impact' as const, userId: currentUser.id, pulseId: newPulse.id, venueId: venueForPulse.id, energyThreshold: (newScore >= 75 ? 'electric' : 'buzzing') as 'electric' | 'buzzing', createdAt: now.toISOString(), read: false }
        return current ? [n, ...current] : [n]
      })
      toast.success('You moved the needle!', { description: `Your pulse pushed ${venueForPulse.name} into ${thresholdLabel}`, duration: 5000 })
    }

    // Wave notification
    if (previousScore - newScore >= 15 && previousScore >= 50 && venues) {
      const altVenue = venues.filter(v => v.id !== venueForPulse.id && v.pulseScore >= 50).sort((a, b) => b.pulseScore - a.pulseScore)[0]
      if (altVenue) {
        setNotifications(current => {
          const n = { id: `notif-wave-${Date.now()}`, type: 'wave' as const, userId: currentUser.id, venueId: venueForPulse.id, recommendedVenueId: altVenue.id, createdAt: now.toISOString(), read: false }
          return current ? [n, ...current] : [n]
        })
      }
    }

    setCreateDialogOpen(false)
  }

  const handleReaction = (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => {
    if (!currentUser) return
    const rateCheck = checkUserRateLimit(currentUser.id, 'reaction')
    if (!rateCheck.allowed) return
    trackEvent({ type: 'pulse_reaction', timestamp: Date.now(), pulseId, reactionType: type })
    if (navigator.vibrate) navigator.vibrate([10])
    setPulses(current => {
      if (!current) return []
      const next = current.map(p => {
        if (p.id !== pulseId) return p
        const reactions = p.reactions[type]
        const hasReacted = reactions.includes(currentUser.id)
        return { ...p, reactions: { ...p.reactions, [type]: hasReacted ? reactions.filter(id => id !== currentUser.id) : [...reactions, currentUser.id] } }
      })
      queryClient.setQueryData(['pulses'], next)
      return next
    })
  }

  const handleNotificationClick = (notification: GroupedNotification) => {
    if ((notification.type === 'friend_pulse' || notification.type === 'pulse_reaction') && notification.venue) {
      navigate(`/venue/${notification.venue.id}`)
      return
    }
    if ((notification.type === 'trending_venue' || notification.type === 'friend_nearby') && notification.venue) {
      navigate(`/venue/${notification.venue.id}`)
      return
    }
    navigate('/')
  }

  const handleAddFriend = (userId: string) => {
    if (!currentUser) return
    trackEvent({ type: 'friend_add', timestamp: Date.now(), method: 'suggestion' })
    setCurrentUser(prev => { if (!prev) return prev!; if (prev.friends.includes(userId)) return prev; return { ...prev, friends: [...prev.friends, userId] } })
    toast.success('Friend added!')
    if (navigator.vibrate) navigator.vibrate([30])
  }

  const handleStoryReact = (_storyId: string, emoji: string) => { toast.success(`Reacted ${emoji}`) }

  const handleEventsUpdate = (updatedEvents: VenueEvent[]) => {
    setEvents(updatedEvents)
    Promise.allSettled(updatedEvents.map(e => postEventToApi(e))).then(results => {
      const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)).length
      if (failures > 0) toast.warning(`Saved locally. ${failures} event sync${failures > 1 ? 's' : ''} pending.`)
    })
  }

  const handleTabChange = (tab: TabId) => {
    navigate(TAB_TO_PATH[tab])
    if (navigator.vibrate) navigator.vibrate([15])
    const labels: Record<TabId, string> = { trending: 'Trending', discover: 'Discover', map: 'Map', notifications: 'Notifications', profile: 'Profile', video: 'Video' }
    announce(`Switched to ${labels[tab]} tab`)
  }

  const handlePulseReport = (report: ContentReport) => {
    setContentReports(current => [report, ...(current || [])])
    toast.success('Report submitted. Thanks for keeping Pulse safe.')
  }

  const handlePromotionImpression = (promotionId: string) => {
    setPromotions(current => { if (!current) return []; return current.map(promo => promo.id !== promotionId || !isPromotionActive(promo) ? promo : recordImpression(promo)) })
  }

  const handlePromotionClick = (promotionId: string) => {
    setPromotions(current => { if (!current) return []; return current.map(promo => promo.id !== promotionId || !isPromotionActive(promo) ? promo : recordClick(promo)) })
  }

  const handleStartCrewCheckIn = (venueId: string) => {
    if (!currentUser) return
    const userCrews = getUserCrews(crews || [], currentUser.id)
    const targetCrew = userCrews.find(crew => crew.memberIds.length > 1)
    if (!targetCrew) { toast.error('Create a crew first to check in together'); return }
    const hasActive = (crewCheckIns || []).some(ci => ci.crewId === targetCrew.id && ci.venueId === venueId && ci.status !== 'completed')
    if (hasActive) { toast.message(`${targetCrew.name} already has an active check-in here`); return }
    const newCheckIn = initiateCrewCheckIn(targetCrew, venueId, currentUser.id, 'buzzing')
    setCrewCheckIns(current => [newCheckIn, ...(current || [])])
    toast.success(`Crew check-in started for ${targetCrew.name}`)
  }

  const handleToggleFavorite = (venueId: string) => {
    setCurrentUser(user => {
      if (!user) return { id: 'user-1', username: 'nightowl', profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl', friends: [], favoriteVenues: [venueId], followedVenues: [], createdAt: new Date().toISOString() }
      const favorites = user.favoriteVenues || []
      if (favorites.includes(venueId)) { toast.success('Removed from favorites'); return { ...user, favoriteVenues: favorites.filter(id => id !== venueId) } }
      if (favorites.length >= 4) { toast.error('Maximum 4 favorites', { description: 'Remove one to add another' }); return user }
      toast.success('Added to favorites')
      return { ...user, favoriteVenues: [...favorites, venueId] }
    })
  }

  const handleToggleFollow = (venueId: string) => {
    setCurrentUser(user => {
      if (!user) return { id: 'user-1', username: 'nightowl', profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl', friends: [], favoriteVenues: [], followedVenues: [venueId], createdAt: new Date().toISOString() }
      const followed = user.followedVenues || []
      if (followed.includes(venueId)) { toast.success('Unfollowed venue'); return { ...user, followedVenues: followed.filter(id => id !== venueId) } }
      if (followed.length >= 10) { toast.error('Maximum 10 followed venues', { description: 'Unfollow one to add another' }); return user }
      toast.success('Following venue')
      return { ...user, followedVenues: [...followed, venueId] }
    })
  }

  return {
    handleCreatePulse,
    handleSubmitPulse,
    handleReaction,
    handleNotificationClick,
    handleAddFriend,
    handleStoryReact,
    handleEventsUpdate,
    handleTabChange,
    handlePulseReport,
    handlePromotionImpression,
    handlePromotionClick,
    handleStartCrewCheckIn,
    handleToggleFavorite,
    handleToggleFollow,
  }
}
