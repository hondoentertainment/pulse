import { lazy, Suspense, type ReactNode } from 'react'
import { useAppState, ALL_USERS } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
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
const NightPlannerPage = lazy(() => import('@/components/NightPlannerPage').then(m => ({ default: m.NightPlannerPage })))
const OwnerDashboardPage = lazy(() => import('@/components/OwnerDashboardPage').then(m => ({ default: m.OwnerDashboardPage })))

const pageFallback = <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>

export function SubPageRouter() {
  const state = useAppState()
  const { handleEventsUpdate, handleTabChange } = useAppHandlers()
  const { updateProfile } = useSupabaseAuth()
  const {
    subPage, setSubPage, activeTab, unreadNotificationCount,
    currentUser, moderatedPulses, venues, crews, crewCheckIns,
    events, playlists, pulses, contentReports,
    userLocation, integrationVenue, setIntegrationVenue,
    integrationsEnabled, setSelectedVenue, setSimulatedLocation,
    setCrews, setCrewCheckIns, setPlaylists,
    setContentReports,
  } = state

  if (!subPage || !currentUser || !venues) return null

  const nav = (
    <BottomNav
      activeTab={activeTab}
      onTabChange={(tab) => { setSubPage(null); handleTabChange(tab) }}
      unreadNotifications={unreadNotificationCount}
    />
  )

  const config: Record<string, () => ReactNode> = {
    achievements: () => (
      <>
        <Suspense fallback={pageFallback}>
          <AchievementsPage currentUser={currentUser} pulses={moderatedPulses} venues={venues} crews={crews || []} onBack={() => setSubPage(null)} />
        </Suspense>
        {nav}
      </>
    ),
    events: () => (
      <>
        <Suspense fallback={pageFallback}>
          <EventsPage venues={venues} events={events || []} currentUserId={currentUser.id} onBack={() => setSubPage(null)} onEventUpdate={handleEventsUpdate} onVenueClick={(venue) => { setSubPage(null); setSelectedVenue(venue) }} />
        </Suspense>
        {nav}
      </>
    ),
    crews: () => (
      <>
        <Suspense fallback={pageFallback}>
          <CrewPage currentUser={currentUser} allUsers={ALL_USERS} crews={crews || []} crewCheckIns={crewCheckIns || []} venues={venues} onBack={() => setSubPage(null)} onCrewsUpdate={setCrews} onCheckInsUpdate={setCrewCheckIns} />
        </Suspense>
        {nav}
      </>
    ),
    insights: () => (
      <>
        <Suspense fallback={pageFallback}>
          <InsightsPage currentUser={currentUser} pulses={moderatedPulses} venues={venues} onBack={() => setSubPage(null)} />
        </Suspense>
        {nav}
      </>
    ),
    neighborhoods: () => (
      <>
        <Suspense fallback={pageFallback}>
          <NeighborhoodView venues={venues} pulses={moderatedPulses} onBack={() => setSubPage(null)} onVenueClick={(venue) => { setSubPage(null); setSelectedVenue(venue) }} />
        </Suspense>
        {nav}
      </>
    ),
    playlists: () => (
      <>
        <Suspense fallback={pageFallback}>
          <PlaylistsPage currentUser={currentUser} playlists={playlists || []} pulses={pulses || []} venues={venues} onBack={() => setSubPage(null)} onPlaylistsUpdate={setPlaylists} />
        </Suspense>
        {nav}
      </>
    ),
    settings: () => (
      <>
        <Suspense fallback={pageFallback}>
          <SettingsPage currentUser={currentUser} onBack={() => setSubPage(null)} onUpdateUser={updateProfile} onCityChange={(loc) => { setSimulatedLocation(loc); toast.success('Location updated') }} />
        </Suspense>
        {nav}
      </>
    ),
    moderation: () => (
      <>
        <Suspense fallback={pageFallback}>
          <ModerationQueuePage reports={contentReports || []} onBack={() => setSubPage(null)} onUpdateReports={setContentReports} />
        </Suspense>
        {nav}
      </>
    ),
    'owner-dashboard': () => (
      <>
        <Suspense fallback={pageFallback}>
          <OwnerDashboardPage currentUser={currentUser} venues={venues} pulses={pulses || []} onBack={() => setSubPage(null)} />
        </Suspense>
        {nav}
      </>
    ),
    'night-planner': () => (
      <>
        <Suspense fallback={pageFallback}>
          <NightPlannerPage
            currentUser={currentUser}
            allUsers={ALL_USERS}
            venues={venues}
            pulses={pulses || []}
            crews={crews || []}
            userLocation={userLocation}
            onBack={() => setSubPage(null)}
            onVenueClick={(venue) => { setSubPage(null); setSelectedVenue(venue) }}
          />
        </Suspense>
        {nav}
      </>
    ),
    integrations: () => {
      if (!integrationVenue || !integrationsEnabled) return null
      return (
        <>
          <Suspense fallback={pageFallback}>
            <IntegrationHub venue={integrationVenue} userLocation={userLocation} venues={venues} currentUser={currentUser} pulses={pulses || []} onBack={() => { setSubPage(null); setIntegrationVenue(null) }} onVenueClick={(venue) => { setSubPage(null); setIntegrationVenue(null); setSelectedVenue(venue) }} />
          </Suspense>
          <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); setIntegrationVenue(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
        </>
      )
    },
  }

  const render = config[subPage]
  return render ? render() : null
}
