import { lazy, Suspense } from 'react'
import { AppStateProvider, useAppState, ALL_USERS } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useNativeAppBootstrap } from '@/hooks/use-native-app-bootstrap'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { calculatePresence } from '@/lib/presence-engine'
import { calculateDistance } from '@/lib/pulse-engine'
import { BottomNav } from '@/components/BottomNav'
import { AppHeader } from '@/components/AppHeader'
import { SubPageRouter } from '@/components/SubPageRouter'
import { MainTabRouter } from '@/components/MainTabRouter'
import type { OnboardingPreferences } from '@/components/OnboardingFlow'
import { Plus } from '@phosphor-icons/react'
import { toast, Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const OnboardingFlow = lazy(() => import('@/components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })))
const VenuePage = lazy(() => import('@/components/VenuePage').then(m => ({ default: m.VenuePage })))
const StoryViewer = lazy(() => import('@/components/StoryViewer').then(m => ({ default: m.StoryViewer })))
const SocialPulseDashboard = lazy(() => import('@/components/SocialPulseDashboard').then(m => ({ default: m.SocialPulseDashboard })))
const PresenceSheet = lazy(() => import('@/components/PresenceSheet').then(m => ({ default: m.PresenceSheet })))
const CreatePulseDialog = lazy(() => import('@/components/CreatePulseDialog').then(m => ({ default: m.CreatePulseDialog })))
const LoginScreen = lazy(() => import('@/components/LoginScreen').then(m => ({ default: m.LoginScreen })))

const pageFallback = <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>

function AppContent() {
  const state = useAppState()
  const handlers = useAppHandlers()
  useNativeAppBootstrap()

  const {
    hasCompletedOnboarding, setHasCompletedOnboarding,
    activeTab, selectedVenue, setSelectedVenue,
    subPage,
    venues, pulses, currentUser,
    showAdminDashboard, setShowAdminDashboard,
    socialDashboardEnabled,
    createDialogOpen, setCreateDialogOpen,
    venueForPulse,
    locationName, isTracking, realtimeLocation,
    locationPermissionDenied, currentTime, queuedPulseCount,
    userLocation, unitSystem, moderatedPulses,
    presenceSheetOpen, setPresenceSheetOpen,
    storyViewerOpen, storyViewerStories,
    setStoryViewerOpen,
    sortedVenues,
    unreadNotificationCount,
    isFavorite, isFollowed,
    integrationsEnabled,
    setIntegrationVenue,
    getPulsesWithUsers,
  } = state

  const {
    handleCreatePulse, handleSubmitPulse, handleReaction,
    handleStartCrewCheckIn, handleToggleFavorite, handleToggleFollow,
    handleTabChange, handleStoryReact, handlePulseReport,
  } = handlers

  const { session, isLoading: authLoading, updateProfile } = useSupabaseAuth()

  // ── Auth gate ────────────────────────────────────────────
  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading Session...</p></div>
  }

  if (!session) {
    return (
      <Suspense fallback={pageFallback}>
        <LoginScreen />
      </Suspense>
    )
  }

  // ── Onboarding gate ──────────────────────────────────────
  if (hasCompletedOnboarding === false) {
    return (
      <Suspense fallback={pageFallback}>
        <OnboardingFlow
          onComplete={(prefs: OnboardingPreferences) => {
            void updateProfile({ favoriteCategories: prefs.favoriteCategories })
            setHasCompletedOnboarding(true)
          }}
        />
      </Suspense>
    )
  }

  // ── Loading gate ─────────────────────────────────────────
  if (!venues || !currentUser || !pulses) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>
  }

  // ── Admin dashboard ──────────────────────────────────────
  if (showAdminDashboard && socialDashboardEnabled) {
    return (
      <Suspense fallback={pageFallback}>
        <SocialPulseDashboard venues={venues} pulses={pulses} onBack={() => setShowAdminDashboard(false)} />
      </Suspense>
    )
  }

  // ── Sub-page overlay ─────────────────────────────────────
  if (subPage) return <SubPageRouter />

  // ── Venue detail page ────────────────────────────────────
  if (selectedVenue) {
    const venuePulses = getPulsesWithUsers().filter(p => p.venueId === selectedVenue.id)
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
            onStartCrewCheckIn={() => handleStartCrewCheckIn(selectedVenue.id)}
            onReaction={handleReaction}
            onReportPulse={handlePulseReport}
            onToggleFavorite={() => handleToggleFavorite(selectedVenue.id)}
            onToggleFollow={() => handleToggleFollow(selectedVenue.id)}
            onOpenIntegrations={() => {
              if (!integrationsEnabled) { toast.error('Integrations are currently unavailable'); return }
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

  // ── Main shell ───────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background pb-20">
      <Toaster position="top-center" theme="dark" />
      <AppHeader
        locationName={locationName}
        isTracking={isTracking}
        hasRealtimeLocation={!!realtimeLocation}
        locationPermissionDenied={locationPermissionDenied}
        currentTime={currentTime}
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
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { if (sortedVenues.length > 0) handleCreatePulse(sortedVenues[0].id) }}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/50 flex items-center justify-center z-40"
        style={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)' }}
      >
        <Plus size={28} weight="bold" />
      </motion.button>
    </main>
  )
}

import { SupabaseAuthProvider } from '@/hooks/use-supabase-auth'

function App() {
  return (
    <SupabaseAuthProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </SupabaseAuthProvider>
  )
}

export default App
