import { lazy, Suspense } from 'react'
import {
  Venue,
  PulseWithUser,
} from '@/lib/types'
import { InteractiveMap } from '@/components/InteractiveMap'
import { NotificationFeed } from '@/components/NotificationFeed'
import { TrendingTab } from '@/components/TrendingTab'
import { ProfileTab } from '@/components/ProfileTab'
import { DiscoverTab } from '@/components/DiscoverTab'
import { BottomNav } from '@/components/BottomNav'
import type { TabId } from '@/components/BottomNav'
import { PresenceSheet } from '@/components/PresenceSheet'
import { CreatePulseDialog } from '@/components/CreatePulseDialog'
import { calculatePresence } from '@/lib/presence-engine'
import type { AppState, SubPage } from '@/hooks/use-app-state'
import { ALL_USERS } from '@/hooks/use-app-state'
import type { AppHandlers } from '@/hooks/use-app-handlers'
import type { OnboardingPreferences } from '@/components/OnboardingFlow'
import { motion, AnimatePresence } from 'framer-motion'

const VenuePage = lazy(() => import('@/components/VenuePage').then(m => ({ default: m.VenuePage })))
const StoryViewer = lazy(() => import('@/components/StoryViewer').then(m => ({ default: m.StoryViewer })))
const SocialPulseDashboard = lazy(() => import('@/components/SocialPulseDashboard').then(m => ({ default: m.SocialPulseDashboard })))
const AchievementsPage = lazy(() => import('@/components/AchievementsPage').then(m => ({ default: m.AchievementsPage })))
const EventsPage = lazy(() => import('@/components/EventsPage').then(m => ({ default: m.EventsPage })))
const CrewPage = lazy(() => import('@/components/CrewPage').then(m => ({ default: m.CrewPage })))
const InsightsPage = lazy(() => import('@/components/InsightsPage').then(m => ({ default: m.InsightsPage })))
const NeighborhoodView = lazy(() => import('@/components/NeighborhoodView').then(m => ({ default: m.NeighborhoodView })))
const PlaylistsPage = lazy(() => import('@/components/PlaylistsPage').then(m => ({ default: m.PlaylistsPage })))
const OnboardingFlow = lazy(() => import('@/components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })))
const SettingsPage = lazy(() => import('@/components/SettingsPage').then(m => ({ default: m.SettingsPage })))
const IntegrationHub = lazy(() => import('@/components/IntegrationHub').then(m => ({ default: m.IntegrationHub })))
const StreakDashboard = lazy(() => import('@/components/StreakDashboard').then(m => ({ default: m.StreakDashboard })))
const VenueComparison = lazy(() => import('@/components/VenueComparison').then(m => ({ default: m.VenueComparison })))
const NeighborhoodWalkthrough = lazy(() => import('@/components/NeighborhoodWalkthrough').then(m => ({ default: m.NeighborhoodWalkthrough })))
const QuickBoostFlow = lazy(() => import('@/components/QuickBoostFlow').then(m => ({ default: m.QuickBoostFlow })))

const pageFallback = <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

interface AppRoutesProps {
  state: AppState
  handlers: AppHandlers
  sortedVenues: Venue[]
  favoriteVenues: Venue[]
  followedVenues: Venue[]
  isFavorite: (venueId: string) => boolean
  isFollowed: (venueId: string) => boolean
}

export function AppRoutes({ state, handlers, sortedVenues, favoriteVenues, followedVenues, isFavorite, isFollowed }: AppRoutesProps) {
  const {
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    activeTab,
    subPage,
    setSubPage,
    selectedVenue,
    setSelectedVenue,
    presenceSheetOpen,
    setPresenceSheetOpen,
    storyViewerOpen,
    storyViewerStories,
    setStoryViewerOpen,
    createDialogOpen,
    setCreateDialogOpen,
    venueForPulse,
    locationName,
    userLocation,
    realtimeLocation,
    isTracking,
    showAdminDashboard,
    trendingSubTab,
    setTrendingSubTab,
    discoverSubTab,
    setDiscoverSubTab,
    integrationsEnabled,
    socialDashboardEnabled,
    unitSystem,
    currentTime,
    currentUser,
    setCurrentUser,
    pulses,
    venues,
    stories,
    events,
    setEvents,
    crews,
    setCrews,
    crewCheckIns,
    setCrewCheckIns,
    playlists,
    setPlaylists,
    promotions,
    integrationVenue,
    setIntegrationVenue,
    unreadNotificationCount,
  } = state

  const {
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
  } = handlers

  // Onboarding
  if (hasCompletedOnboarding === false) {
    return (
      <Suspense fallback={pageFallback}>
        <OnboardingFlow
          onComplete={(prefs: OnboardingPreferences) => {
            if (prefs.favoriteCategories.length > 0) {
              setCurrentUser(prev => prev ? { ...prev, favoriteCategories: prefs.favoriteCategories } : prev!)
            }
            setHasCompletedOnboarding(true)
          }}
        />
      </Suspense>
    )
  }

  // Loading
  if (!venues || !currentUser || !pulses) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  }

  // Admin dashboard
  if (showAdminDashboard && socialDashboardEnabled) {
    return (
      <Suspense fallback={pageFallback}>
        <SocialPulseDashboard
          venues={venues}
          pulses={pulses}
          onBack={() => state.setShowAdminDashboard(false)}
        />
      </Suspense>
    )
  }

  // Sub-pages
  if (subPage === 'achievements') {
    return (
      <>
        <Suspense fallback={pageFallback}>
          <AchievementsPage
            currentUser={currentUser}
            pulses={pulses}
            venues={venues}
            onBack={() => setSubPage(null)}
          />
        </Suspense>
        <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
      </>
    )
  }

  if (subPage === 'events') {
    return (
      <>
        <Suspense fallback={pageFallback}>
          <EventsPage
            venues={venues}
            events={events || []}
            currentUserId={currentUser.id}
            onBack={() => setSubPage(null)}
            onEventUpdate={(updated) => setEvents(updated)}
            onVenueClick={(venue) => { setSubPage(null); setSelectedVenue(venue) }}
          />
        </Suspense>
        <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
      </>
    )
  }

  if (subPage === 'crews') {
    return (
      <>
        <Suspense fallback={pageFallback}>
          <CrewPage
            currentUser={currentUser}
            allUsers={ALL_USERS}
            crews={crews || []}
            crewCheckIns={crewCheckIns || []}
            venues={venues}
            onBack={() => setSubPage(null)}
            onCrewsUpdate={(updated) => setCrews(updated)}
            onCheckInsUpdate={(updated) => setCrewCheckIns(updated)}
          />
        </Suspense>
        <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
      </>
    )
  }

  if (subPage === 'insights') {
    return (
      <>
        <Suspense fallback={pageFallback}>
          <InsightsPage
            currentUser={currentUser}
            pulses={pulses}
            venues={venues}
            onBack={() => setSubPage(null)}
          />
        </Suspense>
        <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
      </>
    )
  }

  if (subPage === 'neighborhoods') {
    return (
      <>
        <Suspense fallback={pageFallback}>
          <NeighborhoodView
            venues={venues}
            pulses={pulses}
            onBack={() => setSubPage(null)}
            onVenueClick={(venue) => { setSubPage(null); setSelectedVenue(venue) }}
          />
        </Suspense>
        <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
      </>
    )
  }

  if (subPage === 'playlists') {
    return (
      <>
        <Suspense fallback={pageFallback}>
          <PlaylistsPage
            currentUser={currentUser}
            playlists={playlists || []}
            pulses={pulses}
            venues={venues}
            onBack={() => setSubPage(null)}
            onPlaylistsUpdate={(updated) => setPlaylists(updated)}
          />
        </Suspense>
        <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
      </>
    )
  }

  if (subPage === 'settings') {
    return (
      <>
        <Suspense fallback={pageFallback}>
          <SettingsPage
            currentUser={currentUser}
            onBack={() => setSubPage(null)}
            onUpdateUser={(user) => setCurrentUser(user)}
            onCityChange={handleCityChange}
          />
        </Suspense>
        <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
      </>
    )
  }

  if (subPage === 'integrations' && integrationVenue && integrationsEnabled) {
    return (
      <>
        <Suspense fallback={pageFallback}>
          <IntegrationHub
            venue={integrationVenue}
            userLocation={userLocation}
            venues={venues}
            currentUser={currentUser}
            pulses={pulses}
            onBack={() => { setSubPage(null); setIntegrationVenue(null) }}
            onVenueClick={(venue) => { setSubPage(null); setIntegrationVenue(null); setSelectedVenue(venue) }}
          />
        </Suspense>
        <BottomNav activeTab={activeTab} onTabChange={(tab) => { setSubPage(null); setIntegrationVenue(null); handleTabChange(tab) }} unreadNotifications={unreadNotificationCount} />
      </>
    )
  }

  // Venue detail page
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
        <Suspense fallback={pageFallback}>
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
            onOpenIntegrations={() => handleOpenIntegrations(selectedVenue)}
          />
        </Suspense>
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
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} unreadNotifications={unreadNotificationCount} />
        <CreatePulseDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          venue={venueForPulse}
          onSubmit={handleSubmitPulse}
        />
      </>
    )
  }

  // Main tab content
  return (
    <>
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
              allUsers={ALL_USERS}
              trendingSubTab={trendingSubTab}
              onSubTabChange={setTrendingSubTab}
              onVenueClick={(venue) => setSelectedVenue(venue)}
              onToggleFavorite={handleToggleFavorite}
              onToggleFollow={handleToggleFollow}
              onReaction={handleReaction}
              isFavorite={isFavorite}
              promotions={promotions || []}
            />
          </motion.div>
        )}

        {activeTab === 'discover' && (
          <motion.div
            key="discover"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <DiscoverTab
              venues={venues}
              pulses={pulses}
              pulsesWithUsers={getPulsesWithUsers()}
              currentUser={currentUser}
              allUsers={ALL_USERS}
              stories={stories || []}
              events={events || []}
              followedVenues={followedVenues}
              userLocation={userLocation}
              unitSystem={unitSystem}
              discoverSubTab={discoverSubTab}
              onSubTabChange={setDiscoverSubTab}
              onVenueClick={(venue) => setSelectedVenue(venue)}
              onStoryClick={handleStoryClick}
              onAddFriend={handleAddFriend}
              onToggleFollow={handleToggleFollow}
              onReaction={handleReaction}
              onNavigate={(page) => setSubPage(page)}
            />
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
                locationHeading={realtimeLocation?.heading}
                followedVenueIds={currentUser?.followedVenues || []}
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
              onOpenSocialPulseDashboard={handleOpenSocialPulseDashboard}
              onOpenSettings={() => setSubPage('settings')}
              onOpenOwnerDashboard={handleOpenOwnerDashboard}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story Viewer Overlay */}
      <AnimatePresence>
        {storyViewerOpen && storyViewerStories.length > 0 && (
          <Suspense fallback={null}>
            <StoryViewer
              stories={storyViewerStories}
              currentUserId={currentUser.id}
              onClose={() => setStoryViewerOpen(false)}
              onReact={handleStoryReact}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </>
  )
}
