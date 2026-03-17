import { useEffect, useMemo } from 'react'
import { Venue } from '@/lib/types'
import { getVenuesByProximity } from '@/lib/pulse-engine'
import { AppProviders } from '@/providers/AppProviders'
import { useAppState } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { AppShell } from '@/components/AppShell'
import { AppRoutes } from '@/components/AppRoutes'
import { setUser as setErrorTrackingUser } from '@/lib/error-tracking'
import { endSession } from '@/lib/analytics'
import { logger } from '@/lib/logger'

function AppContent() {
  const state = useAppState()
  const handlers = useAppHandlers(state)

  const {
    venues,
    currentUser,
    userLocation,
    selectedVenue,
    subPage,
    showAdminDashboard,
    hasCompletedOnboarding,
  } = state

  // Set error-tracking user context whenever the current user changes
  useEffect(() => {
    if (currentUser) {
      setErrorTrackingUser({ id: currentUser.id, username: currentUser.username })
      logger.info('User context set for error tracking', 'App', { userId: currentUser.id })
    }
  }, [currentUser?.id, currentUser?.username])

  // End the analytics session when the page unloads
  useEffect(() => {
    const handleBeforeUnload = () => endSession()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const sortedVenues = useMemo(() => {
    if (!venues) return []
    return userLocation
      ? getVenuesByProximity(venues, userLocation.lat, userLocation.lng)
      : [...venues].sort((a, b) => b.pulseScore - a.pulseScore)
  }, [venues, userLocation])

  const favoriteVenues = useMemo(() => {
    if (!venues || !currentUser) return []
    return (currentUser.favoriteVenues || [])
      .map((id) => venues.find((v) => v.id === id))
      .filter((v): v is Venue => v !== undefined)
  }, [venues, currentUser])

  const followedVenues = useMemo(() => {
    if (!venues || !currentUser) return []
    return (currentUser.followedVenues || [])
      .map((id) => venues.find((v) => v.id === id))
      .filter((v): v is Venue => v !== undefined)
  }, [venues, currentUser])

  const isFavorite = (venueId: string) => {
    return currentUser?.favoriteVenues?.includes(venueId) || false
  }

  const isFollowed = (venueId: string) => {
    return currentUser?.followedVenues?.includes(venueId) || false
  }

  // Routes that render without the shell (onboarding, loading, admin dashboard, sub-pages, venue detail)
  const needsShell = hasCompletedOnboarding !== false
    && venues && currentUser && state.pulses
    && !showAdminDashboard
    && !subPage
    && !selectedVenue

  if (!needsShell) {
    return (
      <AppRoutes
        state={state}
        handlers={handlers}
        sortedVenues={sortedVenues}
        favoriteVenues={favoriteVenues}
        followedVenues={followedVenues}
        isFavorite={isFavorite}
        isFollowed={isFollowed}
      />
    )
  }

  return (
    <AppShell state={state} handlers={handlers} sortedVenues={sortedVenues}>
      <AppRoutes
        state={state}
        handlers={handlers}
        sortedVenues={sortedVenues}
        favoriteVenues={favoriteVenues}
        followedVenues={followedVenues}
        isFavorite={isFavorite}
        isFollowed={isFollowed}
      />
    </AppShell>
  )
}

function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  )
}

export default App
