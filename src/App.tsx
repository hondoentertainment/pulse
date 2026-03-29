import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppStateProvider, useAppState } from '@/hooks/use-app-state'
import { useRouteNavigation } from '@/hooks/use-route-navigation'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { BottomNav } from '@/components/BottomNav'
import { AppHeader } from '@/components/AppHeader'
import { MainTabRouter } from '@/components/MainTabRouter'
import { SubPageRouter } from '@/components/SubPageRouter'
import { VenueRoute } from '@/components/VenueRoute'
import type { OnboardingPreferences } from '@/components/OnboardingFlow'
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
  const state = useAppState()
  const { activeTab, navigateToTab } = useRouteNavigation()
  const { session, isLoading: authLoading, isPlaceholder } = useSupabaseAuth()

  const {
    hasCompletedOnboarding, setHasCompletedOnboarding,
    venues, pulses, currentUser,
    showAdminDashboard, setShowAdminDashboard,
    socialDashboardEnabled,
    createDialogOpen, setCreateDialogOpen,
    venueForPulse,
    locationName, isTracking, realtimeLocation,
    locationPermissionDenied, currentTime, queuedPulseCount,
    sortedVenues,
    unreadNotificationCount,
    setCurrentUser,
    storyViewerOpen, storyViewerStories,
    setStoryViewerOpen,
  } = state

  // Import handlers lazily to avoid circular deps
  const { useAppHandlers } = require('@/hooks/use-app-handlers')
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
        <Route path="/venue/:venueId" element={<VenueRoute />} />

        {/* Sub-pages */}
        <Route path="/events" element={<SubPageRouter page="events" />} />
        <Route path="/crews" element={<SubPageRouter page="crews" />} />
        <Route path="/achievements" element={<SubPageRouter page="achievements" />} />
        <Route path="/insights" element={<SubPageRouter page="insights" />} />
        <Route path="/neighborhoods" element={<SubPageRouter page="neighborhoods" />} />
        <Route path="/playlists" element={<SubPageRouter page="playlists" />} />
        <Route path="/settings" element={<SubPageRouter page="settings" />} />
        <Route path="/integrations" element={<SubPageRouter page="integrations" />} />
        <Route path="/moderation" element={<SubPageRouter page="moderation" />} />
        <Route path="/challenges" element={<SubPageRouter page="challenges" />} />
        <Route path="/my-tickets" element={<SubPageRouter page="my-tickets" />} />
        <Route path="/night-planner" element={<SubPageRouter page="night-planner" />} />

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
            <MainTabRouter tab="discover" />
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
            <MainTabRouter tab="map" />
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
            <MainTabRouter tab="notifications" />
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
            <MainTabRouter tab="profile" />
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
            <MainTabRouter tab="trending" />
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
