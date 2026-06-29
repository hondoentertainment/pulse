import { lazy, Suspense, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState, ALL_USERS } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { BottomNav } from '@/components/BottomNav'
import { ChallengeFeed } from '@/components/ChallengeFeed'
import { PageSkeleton } from '@/components/PageSkeleton'
import { toast } from 'sonner'
import type { SubPage } from '@/hooks/use-app-state'

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
const MyTicketsPage = lazy(() => import('@/components/MyTicketsPage').then(m => ({ default: m.MyTicketsPage })))
const EmergencyContactsPage = lazy(() => import('@/components/safety/EmergencyContactsPage').then(m => ({ default: m.EmergencyContactsPage })))

const pageFallback = <PageSkeleton />

interface SubPageRouterProps {
  /** When rendered from URL routes (`AppRoutes`), the active sub-page comes from the path. */
  page?: SubPage
}

export function SubPageRouter({ page }: SubPageRouterProps) {
  const navigate = useNavigate()
  const state = useAppState()
  const { handleEventsUpdate, handleTabChange, handleJoinChallenge } = useAppHandlers()
  const { updateProfile } = useSupabaseAuth()
  const {
    subPage, setSubPage, activeTab, unreadNotificationCount,
    currentUser, moderatedPulses, venues, crews, crewCheckIns,
    events, playlists, pulses, contentReports, venueChallenges,
    tickets, reservations,
    userLocation, integrationVenue, setIntegrationVenue,
    integrationsEnabled, setSimulatedLocation,
    setCrews, setCrewCheckIns, setPlaylists,
    setContentReports, setTickets, setReservations,
  } = state

  const activePage = page ?? subPage

  if (!activePage || !currentUser || !venues) return null

  const goBack = () => {
    if (page) {
      navigate(-1)
      return
    }
    setSubPage(null)
  }

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
          <AchievementsPage currentUser={currentUser} pulses={moderatedPulses} venues={venues} crews={crews || []} onBack={goBack} />
        </Suspense>
        {nav}
      </>
    ),
    events: () => (
      <>
        <Suspense fallback={pageFallback}>
          <EventsPage venues={venues} events={events || []} currentUserId={currentUser.id} onBack={goBack} onEventUpdate={handleEventsUpdate} onVenueClick={(venue) => navigate(`/venue/${encodeURIComponent(venue.id)}`)} />
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
          <NeighborhoodView venues={venues} pulses={moderatedPulses} onBack={goBack} onVenueClick={(venue) => navigate(`/venue/${encodeURIComponent(venue.id)}`)} />
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
          <SettingsPage
            currentUser={currentUser}
            onBack={goBack}
            onUpdateUser={updateProfile}
            onCityChange={(loc) => { setSimulatedLocation(loc); toast.success('Location updated') }}
            onOpenSafetyContacts={() => navigate('/safety/contacts')}
          />
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
    challenges: () => (
      <>
        <ChallengeFeed
          challenges={venueChallenges || []}
          venues={venues}
          currentUserId={currentUser.id}
          onBack={goBack}
          onJoinChallenge={handleJoinChallenge}
        />
        {nav}
      </>
    ),
    'my-tickets': () => (
      <>
        <Suspense fallback={pageFallback}>
          <MyTicketsPage
            currentUserId={currentUser.id}
            tickets={tickets || []}
            reservations={reservations || []}
            events={events || []}
            venues={venues}
            onBack={goBack}
            onTicketsUpdate={setTickets}
            onReservationsUpdate={setReservations}
          />
        </Suspense>
        {nav}
      </>
    ),
    'owner-dashboard': () => (
      <>
        <Suspense fallback={pageFallback}>
          <OwnerDashboardPage currentUser={currentUser} venues={venues} pulses={pulses || []} onBack={goBack} />
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
            onBack={goBack}
            onVenueClick={(venue) => navigate(`/venue/${encodeURIComponent(venue.id)}`)}
          />
        </Suspense>
        {nav}
      </>
    ),
    integrations: () => {
      if (!integrationsEnabled) {
        return (
          <>
            <UnavailableSubPage
              title="Integrations are not available yet"
              description="Ride, music, and booking integrations are feature-flagged until production credentials are ready."
              onBack={goBack}
            />
            {nav}
          </>
        )
      }

      if (!integrationVenue) {
        return (
          <>
            <UnavailableSubPage
              title="Pick a venue first"
              description="Open a venue, then choose integrations to see ride, music, and nearby options for that specific spot."
              actionLabel="Browse venues"
              onAction={() => navigate('/discover')}
              onBack={goBack}
            />
            {nav}
          </>
        )
      }

      return (
        <>
          <Suspense fallback={pageFallback}>
            <IntegrationHub venue={integrationVenue} userLocation={userLocation} venues={venues} currentUser={currentUser} pulses={pulses || []} onBack={() => { setSubPage(null); setIntegrationVenue(null); navigate(-1) }} onVenueClick={(venue) => { setSubPage(null); setIntegrationVenue(null); navigate(`/venue/${encodeURIComponent(venue.id)}`) }} />
          </Suspense>
          <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); setIntegrationVenue(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
        </>
      )
    },
    'safety-contacts': () => (
      <>
        <Suspense fallback={pageFallback}>
          <EmergencyContactsPage userId={currentUser.id} onBack={goBack} />
        </Suspense>
        {nav}
      </>
    ),
  }

  const render = config[activePage]
  return render ? render() : null
}

function UnavailableSubPage({
  title,
  description,
  actionLabel,
  onAction,
  onBack,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  onBack: () => void
}) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            Back
          </button>
          <h1 className="text-lg font-bold flex-1">{title}</h1>
        </div>
      </div>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
