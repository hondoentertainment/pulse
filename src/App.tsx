import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppStateProvider } from '@/hooks/use-app-state'
import { useVenueState } from '@/hooks/use-venue-state'
import { useUIState } from '@/hooks/use-ui-state'
import { useRouteNavigation } from '@/hooks/use-route-navigation'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { BottomNav } from '@/components/BottomNav'
import { AppHeader } from '@/components/AppHeader'

const MainTabRouter = lazy(() => import('@/components/MainTabRouter').then(m => ({ default: m.MainTabRouter })))
const SubPageRouter = lazy(() => import('@/components/SubPageRouter').then(m => ({ default: m.SubPageRouter })))
const VenueRoute = lazy(() => import('@/components/VenueRoute').then(m => ({ default: m.VenueRoute })))
import type { OnboardingPreferences } from '@/components/OnboardingFlow'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { Plus } from '@phosphor-icons/react'
import { Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const OnboardingFlow = lazy(() => import('@/components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })))
const AuthGate = lazy(() => import('@/components/AuthGate').then(m => ({ default: m.AuthGate })))
const StoryViewer = lazy(() => import('@/components/StoryViewer').then(m => ({ default: m.StoryViewer })))
const SocialPulseDashboard = lazy(() => import('@/components/SocialPulseDashboard').then(m => ({ default: m.SocialPulseDashboard })))
const CreatePulseDialog = lazy(() => import('@/components/CreatePulseDialog').then(m => ({ default: m.CreatePulseDialog })))

const pageFallback = <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>

function AppContent() {
  const venueState = useVenueState()
  const uiState = useUIState()
  const { activeTab, navigateToTab } = useRouteNavigation()
  const { session, isLoading: authLoading, isPlaceholder } = useSupabaseAuth()

  const {
    venues, pulses, currentUser,
    locationName, isTracking, realtimeLocation,
    locationPermissionDenied, currentTime,
    sortedVenues,
    unreadNotificationCount,
    setCurrentUser,
  } = venueState
  const {
    hasCompletedOnboarding, setHasCompletedOnboarding,
    showAdminDashboard, setShowAdminDashboard,
    socialDashboardEnabled,
    createDialogOpen, setCreateDialogOpen,
    venueForPulse,
    queuedPulseCount,
    storyViewerOpen, storyViewerStories,
    setStoryViewerOpen,
  } = uiState

  // Import handlers — top-level import avoids ESM require() crash
  const handlers = useAppHandlers()

  const {
    handleCreatePulse, handleSubmitPulse,
    handleStoryReact,
  } = handlers

  const handleTabChange = (tab: Parameters<typeof navigateToTab>[0]) => {
    navigateToTab(tab)
    if (navigator.vibrate) navigator.vibrate([15])
  }

  // ── Onboarding gate ──────────────────────────────────────
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

  // ── Auth gate (only when real Supabase credentials are configured) ──
  if (!isPlaceholder && !session && !authLoading && hasCompletedOnboarding) {
    return (
      <Suspense fallback={pageFallback}>
        <AuthGate />
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

  // ── Main shell with routes ───────────────────────────────
  return (
    <main className="min-h-screen bg-background pb-20">
      <Toaster position="top-center" theme="dark" />

      <Routes>
        {/* Venue detail page */}
        <Route path="/venue/:venueId" element={<Suspense fallback={pageFallback}><VenueRoute /></Suspense>} />

        {/* Sub-pages */}
        <Route path="/events" element={<Suspense fallback={pageFallback}><SubPageRouter page="events" /></Suspense>} />
        <Route path="/crews" element={<Suspense fallback={pageFallback}><SubPageRouter page="crews" /></Suspense>} />
        <Route path="/achievements" element={<Suspense fallback={pageFallback}><SubPageRouter page="achievements" /></Suspense>} />
        <Route path="/insights" element={<Suspense fallback={pageFallback}><SubPageRouter page="insights" /></Suspense>} />
        <Route path="/neighborhoods" element={<Suspense fallback={pageFallback}><SubPageRouter page="neighborhoods" /></Suspense>} />
        <Route path="/playlists" element={<Suspense fallback={pageFallback}><SubPageRouter page="playlists" /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={pageFallback}><SubPageRouter page="settings" /></Suspense>} />
        <Route path="/integrations" element={<Suspense fallback={pageFallback}><SubPageRouter page="integrations" /></Suspense>} />
        <Route path="/moderation" element={<Suspense fallback={pageFallback}><SubPageRouter page="moderation" /></Suspense>} />
        <Route path="/challenges" element={<Suspense fallback={pageFallback}><SubPageRouter page="challenges" /></Suspense>} />
        <Route path="/my-tickets" element={<Suspense fallback={pageFallback}><SubPageRouter page="my-tickets" /></Suspense>} />
        <Route path="/night-planner" element={<Suspense fallback={pageFallback}><SubPageRouter page="night-planner" /></Suspense>} />

        {/* Main tabs */}
        <Route path="/discover" element={
          <>
            <AppHeader
              locationName={locationName}
              isTracking={isTracking}
              hasRealtimeLocation={!!realtimeLocation}
              locationPermissionDenied={locationPermissionDenied}
              currentTime={currentTime}
              queuedPulseCount={queuedPulseCount}
            />
            <Suspense fallback={pageFallback}>
              <MainTabRouter tab="discover" />
            </Suspense>
          </>
        } />
        <Route path="/map" element={
          <>
            <AppHeader
              locationName={locationName}
              isTracking={isTracking}
              hasRealtimeLocation={!!realtimeLocation}
              locationPermissionDenied={locationPermissionDenied}
              currentTime={currentTime}
              queuedPulseCount={queuedPulseCount}
            />
            <Suspense fallback={pageFallback}>
              <MainTabRouter tab="map" />
            </Suspense>
          </>
        } />
        <Route path="/notifications" element={
          <>
            <AppHeader
              locationName={locationName}
              isTracking={isTracking}
              hasRealtimeLocation={!!realtimeLocation}
              locationPermissionDenied={locationPermissionDenied}
              currentTime={currentTime}
              queuedPulseCount={queuedPulseCount}
            />
            <Suspense fallback={pageFallback}>
              <MainTabRouter tab="notifications" />
            </Suspense>
          </>
        } />
        <Route path="/profile" element={
          <>
            <AppHeader
              locationName={locationName}
              isTracking={isTracking}
              hasRealtimeLocation={!!realtimeLocation}
              locationPermissionDenied={locationPermissionDenied}
              currentTime={currentTime}
              queuedPulseCount={queuedPulseCount}
            />
            <Suspense fallback={pageFallback}>
              <MainTabRouter tab="profile" />
            </Suspense>
          </>
        } />

        {/* Default: trending tab */}
        <Route path="/" element={
          <>
            <AppHeader
              locationName={locationName}
              isTracking={isTracking}
              hasRealtimeLocation={!!realtimeLocation}
              locationPermissionDenied={locationPermissionDenied}
              currentTime={currentTime}
              queuedPulseCount={queuedPulseCount}
            />
            <Suspense fallback={pageFallback}>
              <MainTabRouter tab="trending" />
            </Suspense>
          </>
        } />

        {/* Catch-all: redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

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
