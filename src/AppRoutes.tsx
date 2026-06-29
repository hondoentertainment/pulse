import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link, Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { useAppState } from '@/hooks/use-app-state'
import { useRouteNavigation } from '@/hooks/use-route-navigation'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { usePushRegistration } from '@/hooks/use-push-registration'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useCurrentTime } from '@/hooks/use-current-time'
import { BottomNav } from '@/components/BottomNav'
import { AppHeader } from '@/components/AppHeader'
import { MainTabRouter } from '@/components/MainTabRouter'
import { SubPageRouter } from '@/components/SubPageRouter'
import { VenueRoute } from '@/components/VenueRoute'
import { PulseRoute } from '@/components/PulseRoute'
import { PageSkeleton } from '@/components/PageSkeleton'
import type { OnboardingPreferences } from '@/components/OnboardingFlow'

// ── Lazy page imports ────────────────────────────────────────
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
const GlobalSearch = lazy(() =>
  import('@/components/GlobalSearch').then((m) => ({ default: m.GlobalSearch })),
)
const VenueMetadataRoute = lazy(() =>
  import('@/components/venue-admin/VenueMetadataRoute').then((m) => ({
    default: m.VenueMetadataRoute,
  })),
)

/** Trending home — redirects legacy `/?pulse=` deep links to `/pulse/:id`. */
function TrendingHomeRoute({
  children,
}: {
  children: ReactNode
}) {
  const [params] = useSearchParams()
  const pulseId = params.get('pulse')
  if (pulseId) {
    return <Navigate to={`/pulse/${encodeURIComponent(pulseId)}`} replace />
  }
  return <>{children}</>
}

function NotFoundRoute() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">404</p>
      <h1 className="text-2xl font-bold tracking-tight">This Pulse page does not exist.</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The link may be outdated, or the page may have moved. Head back to trending venues to keep exploring.
      </p>
      <Link
        to="/"
        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
      >
        Back to Trending
      </Link>
    </div>
  )
}

/**
 * AppRoutes — the tab / sub-page / modal switcher.
 *
 * Extracted from the original monolithic `App.tsx`. Every heavy surface
 * (Onboarding, AuthGate, Dashboards, StoryViewer, CreatePulseDialog) is wrapped
 * in `React.lazy` + `<Suspense>` so the initial page paint doesn't need to
 * parse them.
 *
 * **Note:** `src/App.tsx` currently mounts `SignalApp` after auth, not this router.
 * This file remains the venue / discovery experience for reuse or future entry switches.
 */
export function AppRoutes() {
  const state = useAppState()
  const { activeTab, navigateToTab } = useRouteNavigation()
  const navigate = useNavigate()
  const location = useLocation()
  const { session, isLoading: authLoading, isPlaceholder } = useSupabaseAuth()
  // Native-only push registration (no-op on web).
  usePushRegistration({ userId: session?.user?.id })
  const currentTime = useCurrentTime()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchMode, setSearchMode] = useState<'navigate' | 'create'>('navigate')

  const {
    hasCompletedOnboarding, setHasCompletedOnboarding,
    venues, pulses, currentUser,
    showAdminDashboard, setShowAdminDashboard,
    socialDashboardEnabled,
    createDialogOpen, setCreateDialogOpen,
    venueForPulse,
    locationName, isTracking, realtimeLocation,
    locationPermissionDenied, queuedPulseCount,
    sortedVenues,
    visibleVenues,
    selectedMarketKey, setSelectedMarketKey,
    availableMarkets,
    unreadNotificationCount,
    setCurrentUser,
    storyViewerOpen, storyViewerStories,
    setStoryViewerOpen,
  } = state

  const handlers = useAppHandlers()
  const { handleCreatePulse, handleSubmitPulse, handleStoryReact } = handlers

  const handleTabChange = (tab: Parameters<typeof navigateToTab>[0]) => {
    navigateToTab(tab)
    if (navigator.vibrate) navigator.vibrate([15])
  }
  const showGlobalChrome = ['/', '/discover', '/map', '/notifications', '/profile'].includes(location.pathname)

  // ── Onboarding gate ──────────────────────────────────────
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

  // ── Auth gate (only when real Supabase credentials are configured) ──
  if (!isPlaceholder && !session && !authLoading && hasCompletedOnboarding) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AuthGate />
      </Suspense>
    )
  }

  // ── Loading gate ─────────────────────────────────────────
  if (!venues || !currentUser || !pulses) {
    return <PageSkeleton />
  }

  // ── Admin dashboard ──────────────────────────────────────
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
    selectedMarketKey,
    markets: availableMarkets,
    onMarketChange: setSelectedMarketKey,
    onSearchClick: () => {
      setSearchMode('navigate')
      setSearchOpen(true)
    },
  }

  const wrapTab = (tab: 'trending' | 'discover' | 'map' | 'notifications' | 'profile') => (
    <>
      <AppHeader {...headerProps} />
      <MainTabRouter tab={tab} />
    </>
  )

  // ── Main shell with routes ───────────────────────────────
  return (
    <main id="main-content" className="min-h-screen bg-background pb-20" tabIndex={-1}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Toaster position="top-center" theme="dark" />

      <Routes>
        {/* Venue detail page */}
        <Route path="/venue/:venueId" element={<VenueRoute />} />

        {/* Pulse detail (Wave 4) */}
        <Route path="/pulse/:pulseId" element={<PulseRoute />} />

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
        <Route path="/owner-dashboard" element={<SubPageRouter page="owner-dashboard" />} />
        <Route path="/challenges" element={<SubPageRouter page="challenges" />} />
        <Route path="/my-tickets" element={<SubPageRouter page="my-tickets" />} />
        <Route path="/night-planner" element={<SubPageRouter page="night-planner" />} />
        <Route path="/safety/contacts" element={<SubPageRouter page="safety-contacts" />} />

        {/* Main tabs */}
        <Route path="/discover" element={wrapTab('discover')} />
        <Route path="/map" element={wrapTab('map')} />
        <Route path="/notifications" element={wrapTab('notifications')} />
        <Route path="/profile" element={wrapTab('profile')} />
        <Route
          path="/"
          element={(
            <TrendingHomeRoute>
              {wrapTab('trending')}
            </TrendingHomeRoute>
          )}
        />

        {/* Catch-all: keep the miss visible instead of silently losing the bad URL. */}
        <Route path="*" element={<NotFoundRoute />} />
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

      {showGlobalChrome && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          unreadNotifications={unreadNotificationCount}
        />
      )}

      <Suspense fallback={null}>
        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          venues={visibleVenues}
          onSelectVenue={(venueId) => {
            if (searchMode === 'create') {
              handleCreatePulse(venueId)
              return
            }
            navigate(`/venue/${encodeURIComponent(venueId)}`)
          }}
          onSelectCity={(cityName) => {
            const match = availableMarkets.find(
              (market) => market.name.toLowerCase() === cityName.toLowerCase(),
            )
            if (match) setSelectedMarketKey(match.key)
          }}
        />
        <CreatePulseDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          venue={venueForPulse}
          onSubmit={handleSubmitPulse}
        />
      </Suspense>

      {showGlobalChrome && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (sortedVenues.length === 1) {
              handleCreatePulse(sortedVenues[0].id)
              return
            }
            setSearchMode('create')
            setSearchOpen(true)
          }}
          aria-label="Create a pulse"
          data-testid="create-pulse-fab"
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/50 flex items-center justify-center z-[60]"
          style={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)' }}
        >
          <Plus size={28} weight="bold" />
        </motion.button>
      )}
    </main>
  )
}
