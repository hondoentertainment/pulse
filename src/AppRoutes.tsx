import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { useAppState } from '@/hooks/use-app-state'
import {
  useRouteNavigation,
  deriveActiveTab,
  deriveSubPage,
  isTabPath,
} from '@/hooks/use-route-navigation'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useCurrentTime } from '@/hooks/use-current-time'
import { BottomNav } from '@/components/BottomNav'
import { AppHeader } from '@/components/AppHeader'
import { MainTabRouter } from '@/components/MainTabRouter'
import { SubPageRouter } from '@/components/SubPageRouter'
import { VenueRoute } from '@/components/VenueRoute'
import { VenueInboxRoute } from '@/components/VenueInboxRoute'
import { PageSkeleton } from '@/components/PageSkeleton'
import { MapHomeSkeleton } from '@/components/MapHomeSkeleton'
import { OfflineBanner } from '@/components/OfflineBanner'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import type { OnboardingPreferences } from '@/components/OnboardingFlow'
import { AUTH_PATH, shouldBlockDiscoveryForAuth } from '@/lib/guest-discovery'
import { UX_FAB } from '@/lib/ux-chrome'

// ── Lazy page imports ────────────────────────
// Each of these is a heavy, rarely-used surface; React.lazy() emits a separate
// chunk so the initial bundle stays small.
const OnboardingFlow = lazy(() =>
  import('@/components/OnboardingFlow').then((m) => ({ default: m.OnboardingFlow })),
)
const AuthGate = lazy(() =>
  import('@/components/AuthGate').then((m) => ({ default: m.AuthGate })),
)
const StoryViewer = lazy(() =>
  import('@/components/StoryViewer').then((m) => ({ default: m.StoryViewer })),
)
const SocialPulseDashboard = lazy(() =>
  import('@/components/SocialPulseDashboard').then((m) => ({ default: m.SocialPulseDashboard })),
)
const CreatePulseDialog = lazy(() =>
  import('@/components/CreatePulseDialog').then((m) => ({ default: m.CreatePulseDialog })),
)
const VenueMetadataRoute = lazy(() =>
  import('@/components/venue-admin/VenueMetadataRoute').then((m) => ({
    default: m.VenueMetadataRoute,
  })),
)
const OpsQueuePage = lazy(() =>
  import('@/components/OpsQueuePage').then((m) => ({ default: m.OpsQueuePage })),
)

/**
 * AppRoutes — the tab / sub-page / modal switcher.
 *
 * Extracted from the original monolithic `App.tsx`. Every heavy surface
 * (Onboarding, AuthGate, Dashboards, StoryViewer, CreatePulseDialog) is wrapped
 * in `React.lazy` + `<Suspense>` so the initial page paint doesn't need to
 * parse them.
 *
 * **Mounting:** `src/App.tsx` → `VenueApp` always mounts this router.
 *
 * **Guest browse:** map + venues are public after onboarding. AuthGate is
 * only the `/auth` route for write actions (Create Pulse, live reviews,
 * inbox, claims) — it must not replace the discovery shell.
 *
 * **URL ↔ state:** `MainTabRouter`/`SubPageRouter` render from `useAppState`
 * (`activeTab` / `subPage`). A `useEffect` below syncs app state from the
 * pathname so a direct load of `/discover`, `/events`, etc. renders the
 * right surface instead of the default tab or a blank `SubPageRouter`.
 */
export function AppRoutes() {
  const state = useAppState()
  const { activeTab, navigateToTab, location } = useRouteNavigation()
  const { session, isLoading: authLoading, isPlaceholder } = useSupabaseAuth()
  const currentTime = useCurrentTime()

  const {
    hasCompletedOnboarding, setHasCompletedOnboarding,
    venues, pulses, currentUser,
    showAdminDashboard, setShowAdminDashboard,
    socialDashboardEnabled,
    createDialogOpen, setCreateDialogOpen,
    venueForPulse,
    locationName, isTracking, realtimeLocation, userLocation,
    locationPermissionDenied, queuedPulseCount,
    sortedVenues,
    selectedMarketKey: _selectedMarketKey, setSelectedMarketKey: _setSelectedMarketKey,
    availableMarkets: _availableMarkets,
    unreadNotificationCount,
    setCurrentUser,
    storyViewerOpen, storyViewerStories,
    setStoryViewerOpen,
    setActiveTab, setSubPage,
  } = state
  const [pulseDialogReady, setPulseDialogReady] = useState(false)
  useEffect(() => {
    if (createDialogOpen) setPulseDialogReady(true)
  }, [createDialogOpen])

  // URL → app-state sync. MainTabRouter/SubPageRouter render from useAppState,
  // so without this a direct load / refresh of /discover, /events, etc. would
  // show the default tab or a blank sub-page.
  const pathname = location.pathname
  useEffect(() => {
    if (isTabPath(pathname)) {
      setActiveTab(deriveActiveTab(pathname))
      setSubPage(null)
      return
    }
    const sub = deriveSubPage(pathname)
    if (sub) setSubPage(sub)
  }, [pathname, setActiveTab, setSubPage])

  const handlers = useAppHandlers()
  const { handleCreatePulse, handleSubmitPulse, handleStoryReact } = handlers

  const handleTabChange = (tab: Parameters<typeof navigateToTab>[0]) => {
    navigateToTab(tab)
    if (navigator.vibrate) navigator.vibrate([15])
  }

  // ── Onboarding gate ──────────────────────
  if (hasCompletedOnboarding === false) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <OnboardingFlow
          onComplete={(prefs: OnboardingPreferences) => {
            if (prefs.favoriteCategories.length > 0) {
              setCurrentUser((prev) =>
                prev ? { ...prev, favoriteCategories: prefs.favoriteCategories } : prev!,
              )
            }
            setHasCompletedOnboarding(true)
          }}
        />
      </Suspense>
    )
  }

  // Sign-in is opt-in for write actions. Do not replace map + venues.
  if (pathname === AUTH_PATH) {
    if (authLoading) {
      return <PageSkeleton />
    }
    // Real sessions can leave /auth. Guests — including local placeholder
    // mode — must stay here when Follow / write sends them to sign in.
    if (session) {
      return <Navigate to="/" replace />
    }
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AuthGate />
      </Suspense>
    )
  }

  if (shouldBlockDiscoveryForAuth({
    isPlaceholder,
    hasSession: Boolean(session),
    authLoading,
    hasCompletedOnboarding: Boolean(hasCompletedOnboarding),
  })) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AuthGate />
      </Suspense>
    )
  }

  // ── Loading gate ─────────────────────────
  if (!venues || !currentUser || !pulses) {
    const onMap = pathname === '/' || pathname === '/map'
    return onMap ? <MapHomeSkeleton /> : <PageSkeleton />
  }

  // ── Admin dashboard ──────────────────────
  if (showAdminDashboard && socialDashboardEnabled) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <SocialPulseDashboard
          venues={venues}
          pulses={pulses}
          onBack={() => setShowAdminDashboard(false)}
        />
      </Suspense>
    )
  }

  // The AppHeader is repeated on every main tab route; extract to keep JSX
  // readable and avoid re-declaring its prop bag inline 5 times.
  const headerProps = {
    locationName,
    isTracking,
    hasRealtimeLocation: !!realtimeLocation,
    locationPermissionDenied,
    currentTime,
    queuedPulseCount,
  }

  // MainTabRouter / SubPageRouter read activeTab / subPage from app state.
  const wrapTab = () => (
    <>
      {activeTab !== 'map' && <AppHeader {...headerProps} />}
      <MainTabRouter />
    </>
  )

  // ── Main shell with routes ───────────────────────
  return (
    <main className="min-h-screen bg-background pb-20">
      <OfflineBanner />
      <Toaster position="top-center" theme="dark" />

      <Routes>
        {/* Venue detail page */}
        <Route path="/venue/:venueId" element={<VenueRoute />} />
        <Route
          path="/venue/:venueId/inbox"
          element={(
            <ProtectedRoute>
              <VenueInboxRoute />
            </ProtectedRoute>
          )}
        />

        {/* Admin-only: structured venue metadata editor. Non-admins get a 403
            rendered by VenueMetadataRoute itself. */}
        <Route
          path="/admin/venues/:id/metadata"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <VenueMetadataRoute />
            </Suspense>
          }
        />
        <Route
          path="/ops"
          element={(
            <ProtectedRoute>
              <Suspense fallback={<PageSkeleton />}>
                <OpsQueuePage />
              </Suspense>
            </ProtectedRoute>
          )}
        />

        {/* Sub-pages */}
        <Route path="/events" element={<SubPageRouter />} />
        <Route path="/crews" element={<SubPageRouter />} />
        <Route path="/achievements" element={<SubPageRouter />} />
        <Route path="/insights" element={<SubPageRouter />} />
        <Route path="/neighborhoods" element={<SubPageRouter />} />
        <Route path="/playlists" element={<SubPageRouter />} />
        <Route path="/settings" element={<SubPageRouter />} />
        <Route path="/integrations" element={<SubPageRouter />} />
        <Route path="/moderation" element={<SubPageRouter />} />
        <Route path="/challenges" element={<SubPageRouter />} />
        <Route path="/my-tickets" element={<SubPageRouter />} />
        <Route path="/night-planner" element={<SubPageRouter />} />

        {/* Main tabs — map is the production home */}
        <Route path="/discover" element={wrapTab()} />
        <Route path="/map" element={wrapTab()} />
        <Route path="/trending" element={wrapTab()} />
        <Route path="/notifications" element={wrapTab()} />
        <Route path="/profile" element={wrapTab()} />
        <Route path="/" element={wrapTab()} />

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

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadNotifications={unreadNotificationCount}
      />

      {pulseDialogReady && (
        <Suspense fallback={null}>
          <CreatePulseDialog
            open={createDialogOpen}
            onClose={() => setCreateDialogOpen(false)}
            venue={venueForPulse}
            userLocation={userLocation ?? realtimeLocation ?? null}
            onSubmit={handleSubmitPulse}
          />
        </Suspense>
      )}

      <motion.button
        type="button"
        data-testid="create-pulse-fab"
        aria-label="Create Pulse"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (sortedVenues.length > 0) handleCreatePulse(sortedVenues[0].id)
        }}
        className={UX_FAB}
      >
        <Plus size={28} weight="bold" />
      </motion.button>
    </main>
  )
}
