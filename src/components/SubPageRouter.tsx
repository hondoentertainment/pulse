import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState, ALL_USERS, type SubPage } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useRouteNavigation } from '@/hooks/use-route-navigation'
import { BottomNav } from '@/components/BottomNav'
import { toast } from 'sonner'

const AchievementsPage = lazy(() => import('@/components/AchievementsPage').then(m => ({ default: m.AchievementsPage })))
const EventsPage = lazy(() => import('@/components/EventsPage').then(m => ({ default: m.EventsPage })))
const CrewPage = lazy(() => import('@/components/CrewPage').then(m => ({ default: m.CrewPage })))
const InsightsPage = lazy(() => import('@/components/InsightsPage').then(m => ({ default: m.InsightsPage })))
const NeighborhoodView = lazy(() => import('@/components/NeighborhoodView').then(m => ({ default: m.NeighborhoodView })))
const PlaylistsPage = lazy(() => import('@/components/PlaylistsPage').then(m => ({ default: m.PlaylistsPage })))
const SettingsPage = lazy(() => import('@/components/SettingsPage').then(m => ({ default: m.SettingsPage })))
const IntegrationHub = lazy(() => import('@/components/IntegrationHub').then(m => ({ default: m.IntegrationHub })))
const ModerationQueuePage = lazy(() => import('@/components/ModerationQueuePage').then(m => ({ default: m.ModerationQueuePage })))

const pageFallback = <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>

interface SubPageRouterProps {
  page?: NonNullable<SubPage>
}

export function SubPageRouter({ page: pageProp }: SubPageRouterProps) {
  const navigate = useNavigate()
  const { activeTab, navigateToTab } = useRouteNavigation()
  const state = useAppState()
  const { handleEventsUpdate } = useAppHandlers()
  const {
    subPage, unreadNotificationCount,
    currentUser, moderatedPulses, venues, crews, crewCheckIns,
    events, playlists, pulses, contentReports,
    userLocation, integrationVenue, setIntegrationVenue,
    integrationsEnabled, setSimulatedLocation,
    setCurrentUser, setCrews, setCrewCheckIns, setPlaylists,
    setContentReports,
  } = state

  // Use the page prop from the route if provided, otherwise fall back to state
  const page = pageProp ?? subPage

  if (!page || !currentUser || !venues) return null

  const goBack = () => navigate(-1)

  const navigateToVenue = (venue: { id: string }) => {
    navigate(`/venue/${venue.id}`)
  }

  const nav = (
    <BottomNav
      activeTab={activeTab}
      onTabChange={(tab) => navigateToTab(tab)}
      unreadNotifications={unreadNotificationCount}
    />
  )

  const config: Record<string, () => JSX.Element> = {
    achievements: () => (
      <>
        <Suspense fallback={pageFallback}>
          <AchievementsPage currentUser={currentUser} pulses={moderatedPulses} venues={venues} crews={crews || []} onBack={goBack} />
        </Suspense>
        {nav}
      </>
    ),
    events: () => (
      <>
        <Suspense fallback={pageFallback}>
          <EventsPage venues={venues} events={events || []} currentUserId={currentUser.id} onBack={goBack} onEventUpdate={handleEventsUpdate} onVenueClick={navigateToVenue} />
        </Suspense>
        {nav}
      </>
    ),
    crews: () => (
      <>
        <Suspense fallback={pageFallback}>
          <CrewPage currentUser={currentUser} allUsers={ALL_USERS} crews={crews || []} crewCheckIns={crewCheckIns || []} venues={venues} onBack={goBack} onCrewsUpdate={setCrews} onCheckInsUpdate={setCrewCheckIns} />
        </Suspense>
        {nav}
      </>
    ),
    insights: () => (
      <>
        <Suspense fallback={pageFallback}>
          <InsightsPage currentUser={currentUser} pulses={moderatedPulses} venues={venues} onBack={goBack} />
        </Suspense>
        {nav}
      </>
    ),
    neighborhoods: () => (
      <>
        <Suspense fallback={pageFallback}>
          <NeighborhoodView venues={venues} pulses={moderatedPulses} onBack={goBack} onVenueClick={navigateToVenue} />
        </Suspense>
        {nav}
      </>
    ),
    playlists: () => (
      <>
        <Suspense fallback={pageFallback}>
          <PlaylistsPage currentUser={currentUser} playlists={playlists || []} pulses={pulses || []} venues={venues} onBack={goBack} onPlaylistsUpdate={setPlaylists} />
        </Suspense>
        {nav}
      </>
    ),
    settings: () => (
      <>
        <Suspense fallback={pageFallback}>
          <SettingsPage currentUser={currentUser} onBack={goBack} onUpdateUser={setCurrentUser} onCityChange={(loc) => { setSimulatedLocation(loc); toast.success('Location updated') }} />
        </Suspense>
        {nav}
      </>
    ),
    moderation: () => (
      <>
        <Suspense fallback={pageFallback}>
          <ModerationQueuePage reports={contentReports || []} onBack={goBack} onUpdateReports={setContentReports} />
        </Suspense>
        {nav}
      </>
    ),
    integrations: () => {
      if (!integrationVenue || !integrationsEnabled) return null as unknown as JSX.Element
      return (
        <>
          <Suspense fallback={pageFallback}>
            <IntegrationHub venue={integrationVenue} userLocation={userLocation} venues={venues} currentUser={currentUser} pulses={pulses || []} onBack={() => { setIntegrationVenue(null); goBack() }} onVenueClick={(venue) => { setIntegrationVenue(null); navigateToVenue(venue) }} />
          </Suspense>
          <BottomNav activeTab={activeTab} onTabChange={(tab) => { setIntegrationVenue(null); navigateToTab(tab) }} unreadNotifications={unreadNotificationCount} />
        </>
      )
    },
  }

  const render = config[page]
  return render ? render() : null
}
