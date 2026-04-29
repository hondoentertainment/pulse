import { lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from '@phosphor-icons/react'
import { toast, Toaster } from 'sonner'

import { useAppState, ALL_USERS } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useNativeAppBootstrap } from '@/hooks/use-native-app-bootstrap'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { calculatePresence } from '@/lib/presence-engine'
import { calculateDistance } from '@/lib/pulse-engine'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { MainTabRouter } from '@/components/MainTabRouter'
import { SubPageRouter } from '@/components/SubPageRouter'

const VenuePage = lazy(() => import('@/components/VenuePage').then(m => ({ default: m.VenuePage })))
const StoryViewer = lazy(() => import('@/components/StoryViewer').then(m => ({ default: m.StoryViewer })))
const SocialPulseDashboard = lazy(() => import('@/components/SocialPulseDashboard').then(m => ({ default: m.SocialPulseDashboard })))
const PresenceSheet = lazy(() => import('@/components/PresenceSheet').then(m => ({ default: m.PresenceSheet })))
const CreatePulseDialog = lazy(() => import('@/components/CreatePulseDialog').then(m => ({ default: m.CreatePulseDialog })))

const pageFallback = (
  <main className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite">
    <p className="text-muted-foreground">Loading...</p>
  </main>
)

export function AppShell() {
  const state = useAppState()
  const handlers = useAppHandlers()
  const { updateProfile } = useSupabaseAuth()

  useNativeAppBootstrap()

  const {
    activeTab, selectedVenue, setSelectedVenue,
    subPage,
    venues, pulses, currentUser,
    showAdminDashboard, setShowAdminDashboard,
    socialDashboardEnabled,
    createDialogOpen, setCreateDialogOpen,
    venueForPulse,
    locationName, isTracking, realtimeLocation,
    locationPermissionDenied, queuedPulseCount,
    userLocation, unitSystem,
    presenceSheetOpen, setPresenceSheetOpen,
    storyViewerOpen, storyViewerStories,
    setStoryViewerOpen,
    sortedVenues,
    unreadNotificationCount,
    isFavorite, isFollowed,
    integrationsEnabled,
    setIntegrationVenue,
    pulsesWithUsers,
  } = state

  const {
    handleCreatePulse, handleSubmitPulse, handleReaction,
    handleStartCrewCheckIn, handleToggleFavorite, handleToggleFollow,
    handleTabChange, handleStoryReact, handlePulseReport,
  } = handlers

  if (!venues || !currentUser || !pulses) {
    return pageFallback
  }

  if (showAdminDashboard && socialDashboardEnabled) {
    return (
      <Suspense fallback={pageFallback}>
        <SocialPulseDashboard venues={venues} pulses={pulses} onBack={() => setShowAdminDashboard(false)} />
      </Suspense>
    )
  }

  if (subPage) return <SubPageRouter />

  if (selectedVenue) {
    const venuePulses = pulsesWithUsers.filter(p => p.venueId === selectedVenue.id)
    const distance = userLocation
      ? calculateDistance(userLocation.lat, userLocation.lng, selectedVenue.location.lat, selectedVenue.location.lng)
      : undefined

    const presenceData = calculatePresence(selectedVenue.id, {
      currentUser,
      allUsers: ALL_USERS,
      allPulses: pulses || [],
      venueLocation: selectedVenue.location,
      userLocations: {
        'user-2': { lat: selectedVenue.location.lat + 0.00001, lng: selectedVenue.location.lng - 0.00001, lastUpdate: new Date().toISOString() },
        'user-3': { lat: selectedVenue.location.lat - 0.00001, lng: selectedVenue.location.lng + 0.00001, lastUpdate: new Date().toISOString() },
        'user-5': { lat: selectedVenue.location.lat + 0.00002, lng: selectedVenue.location.lng + 0.00002, lastUpdate: new Date().toISOString() },
      },
    })

    return (
      <>
        <Toaster position="top-center" theme="dark" />
        <Suspense fallback={pageFallback}>
          <VenuePage
            venue={selectedVenue}
            venuePulses={venuePulses}
            distance={distance}
            userLocation={userLocation}
            unitSystem={unitSystem}
            locationName={locationName}
            isTracking={isTracking}
            hasRealtimeLocation={!!realtimeLocation}
            isFavorite={isFavorite(selectedVenue.id)}
            isFollowed={isFollowed(selectedVenue.id)}
            currentUser={currentUser}
            presenceData={presenceData}
            onOpenPresence={() => setPresenceSheetOpen(true)}
            onBack={() => setSelectedVenue(null)}
            onCreatePulse={() => handleCreatePulse(selectedVenue.id)}
            onStartCrewCheckIn={() => handleStartCrewCheckIn(selectedVenue.id)}
            onReaction={handleReaction}
            onReportPulse={handlePulseReport}
            onToggleFavorite={() => handleToggleFavorite(selectedVenue.id)}
            onToggleFollow={() => handleToggleFollow(selectedVenue.id)}
            onOpenIntegrations={() => {
              if (!integrationsEnabled) {
                toast.error('Integrations are currently unavailable')
                return
              }
              setIntegrationVenue(selectedVenue)
              setSelectedVenue(null)
              state.setSubPage('integrations')
            }}
          />
        </Suspense>
        <Suspense fallback={null}>
          <PresenceSheet
            open={presenceSheetOpen}
            onClose={() => setPresenceSheetOpen(false)}
            presence={presenceData}
            currentUser={currentUser}
            onUpdateSettings={(settings) => {
              void updateProfile({ presenceSettings: settings })
            }}
          />
        </Suspense>
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} unreadNotifications={unreadNotificationCount} />
        <Suspense fallback={null}>
          <CreatePulseDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} venue={venueForPulse} onSubmit={handleSubmitPulse} />
        </Suspense>
      </>
    )
  }

  return (
    <main className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <Toaster position="top-center" theme="dark" />
      <AppHeader
        locationName={locationName}
        isTracking={isTracking}
        hasRealtimeLocation={!!realtimeLocation}
        locationPermissionDenied={locationPermissionDenied}
        queuedPulseCount={queuedPulseCount}
      />

      <MainTabRouter />

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

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} unreadNotifications={unreadNotificationCount} />
      <Suspense fallback={null}>
        <CreatePulseDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} venue={venueForPulse} onSubmit={handleSubmitPulse} />
      </Suspense>

      <motion.button
        data-testid="create-pulse-fab"
        aria-label="Create a pulse"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { if (sortedVenues.length > 0) handleCreatePulse(sortedVenues[0].id) }}
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] right-[calc(1.5rem+env(safe-area-inset-right,0px))] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/50 flex items-center justify-center z-40 touch-manipulation"
        style={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)' }}
      >
        <Plus size={28} weight="bold" />
      </motion.button>
    </main>
  )
}
