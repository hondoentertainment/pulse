import { lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppState, ALL_USERS } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { BottomNav } from '@/components/BottomNav'
import { useRouteNavigation } from '@/hooks/use-route-navigation'

const VenuePage = lazy(() => import('@/components/VenuePage').then(m => ({ default: m.VenuePage })))

const pageFallback = <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>

export function VenueRoute() {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()
  const { activeTab, navigateToTab } = useRouteNavigation()
  const state = useAppState()
  const handlers = useAppHandlers()

  const {
    venues,
    currentUser,
    moderatedPulses,
    unitSystem,
    locationName,
    currentTime,
    isTracking,
    realtimeLocation,
    userLocation,
    unreadNotificationCount,
    isFavorite,
    isFollowed,
    integrationsEnabled,
    getPulsesWithUsers,
    presenceSheetOpen,
    setPresenceSheetOpen,
    setIntegrationVenue,
    setSubPage,
  } = state

  const {
    handleCreatePulse,
    handleReaction,
    handlePulseReport,
    handleToggleFavorite,
    handleToggleFollow,
    handleStartCrewCheckIn,
  } = handlers

  if (!venues || !currentUser || !venueId) return null

  const venue = venues.find(v => v.id === venueId)
  if (!venue) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Venue not found</p>
        <button onClick={() => navigate('/')} className="text-primary underline">Go home</button>
      </div>
    )
  }

  const venuePulses = getPulsesWithUsers().filter(p => p.venueId === venue.id)
  const distance = userLocation
    ? Math.sqrt(Math.pow(venue.location.lat - userLocation.lat, 2) + Math.pow(venue.location.lng - userLocation.lng, 2)) * 69
    : undefined

  return (
    <>
      <Suspense fallback={pageFallback}>
        <VenuePage
          venue={venue}
          venuePulses={venuePulses}
          distance={distance}
          unitSystem={unitSystem}
          locationName={locationName}
          currentTime={currentTime}
          isTracking={isTracking}
          hasRealtimeLocation={!!realtimeLocation}
          isFavorite={isFavorite(venue.id)}
          isFollowed={isFollowed(venue.id)}
          currentUser={currentUser}
          onBack={() => navigate(-1)}
          onCreatePulse={() => handleCreatePulse(venue.id)}
          onStartCrewCheckIn={() => handleStartCrewCheckIn(venue.id)}
          onReaction={handleReaction}
          onReportPulse={handlePulseReport}
          onToggleFavorite={() => handleToggleFavorite(venue.id)}
          onToggleFollow={() => handleToggleFollow(venue.id)}
          presenceData={null}
          onOpenPresence={() => setPresenceSheetOpen(true)}
          onOpenIntegrations={integrationsEnabled ? () => {
            setIntegrationVenue(venue)
            navigate('/integrations')
          } : undefined}
        />
      </Suspense>
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => navigateToTab(tab)}
        unreadNotifications={unreadNotificationCount}
      />
    </>
  )
}
