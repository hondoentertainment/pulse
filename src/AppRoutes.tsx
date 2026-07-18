import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useKV } from '@github/spark/hooks'
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
import { BottomNav, type TabId } from '@/components/BottomNav'
import { AppHeader } from '@/components/AppHeader'
import { MainTabRouter } from '@/components/MainTabRouter'
import { SubPageRouter } from '@/components/SubPageRouter'
import { VenueRoute } from '@/components/VenueRoute'
import { PulseRoute } from '@/components/PulseRoute'
import { PageSkeleton } from '@/components/PageSkeleton'
import { isGuestBrowseEnabled } from '@/lib/guest-browse'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { shouldRedirectToWelcome } from '@/lib/welcome-gate'
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
const VenueCompletenessPage = lazy(() =>
  import('@/components/venue-admin/VenueCompletenessPage').then((m) => ({
    default: m.VenueCompletenessPage,
  })),
)
const SignalAdminPage = lazy(() =>
  import('@/components/venue-admin/SignalAdminPage').then((m) => ({
    default: m.SignalAdminPage,
  })),
)
const VenueDataReportsPage = lazy(() =>
  import('@/components/venue-admin/VenueDataReportsPage').then((m) => ({
    default: m.VenueDataReportsPage,
  })),
)
const VenueDuplicatesPage = lazy(() =>
  import('@/components/venue-admin/VenueDuplicatesPage').then((m) => ({
    default: m.VenueDuplicatesPage,
  })),
)
const ShortlistPage = lazy(() =>
  import('@/components/ShortlistPage').then((m) => ({
    default: m.ShortlistPage,
  })),
)
const SeattleLandingPage = lazy(() =>
  import('@/components/SeattleLandingPage').then((m) => ({
    default: m.SeattleLandingPage,
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
        The link may be outdated, or the page may have moved. Head back to Tonight to keep deciding.
      </p>
      <Link
        to="/"
        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
      >
        Back to Tonight
      </Link>
    </div>
  )
}

function WelcomeRedirect({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (shouldRedirectToWelcome(location.pathname)) {
    return <Navigate to="/welcome" replace />
  }
  return <>{children}</>
}

function FeatureFlaggedRoute({
  flag,
  children,
}: {
  flag: Parameters<typeof isFeatureEnabled>[0]
  children: ReactNode
}) {
  if (!isFeatureEnabled(flag)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
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
  const [guestBrowse] = useKV<boolean>('pulse-guest-browse', false)
  const allowGuestBrowse = isGuestBrowseEnabled() && guestBrowse === true
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
  if (!isPlaceholder && !session && !authLoading && hasCompletedOnboarding && !allowGuestBrowse) {
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

  const wrapTab = (tab: TabId | 'trending') => (
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

        {/* Seattle conversion landing */}
        <Route
          path="/welcome"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <SeattleLandingPage />
            </Suspense>
          }
        />

        {/* Shareable group shortlist (P1-5) */}
        <Route
          path="/shortlist"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <ShortlistPage />
            </Suspense>
          }
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

        {/* Admin-only: venue data-quality completeness dashboard. Non-admins
            get a 403 rendered by VenueCompletenessPage itself. */}
        <Route
          path="/admin/venues/completeness"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <VenueCompletenessPage />
            </Suspense>
          }
        />

        {/* Admin-only: user-submitted catalog quality report queue.
            Non-admins get a 403 rendered by VenueDataReportsPage itself. */}
        <Route
          path="/admin/venues/data-reports"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <VenueDataReportsPage />
            </Suspense>
          }
        />

        {/* Admin-only: likely duplicate venue detection. Non-admins get a
            403 rendered by VenueDuplicatesPage itself. */}
        <Route
          path="/admin/venues/duplicates"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <VenueDuplicatesPage />
            </Suspense>
          }
        />

        <Route
          path="/admin/signal"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <SignalAdminPage />
            </Suspense>
          }
        />

        {/* Sub-pages */}
        <Route path="/events" element={<SubPageRouter page="events" />} />
        <Route path="/crews" element={<SubPageRouter page="crews" />} />
        <Route path="/achievements" element={<SubPageRouter page="achievements" />} />
        <Route path="/insights" element={<SubPageRouter page="insights" />} />
        <Route path="/dashboard" element={<SubPageRouter page="dashboard" />} />
        <Route path="/neighborhoods" element={<SubPageRouter page="neighborhoods" />} />
        <Route path="/playlists" element={<SubPageRouter page="playlists" />} />
        <Route path="/settings" element={<SubPageRouter page="settings" />} />
        <Route path="/integrations" element={<SubPageRouter page="integrations" />} />
        <Route path="/moderation" element={<SubPageRouter page="moderation" />} />
        <Route path="/owner-dashboard" element={<SubPageRouter page="owner-dashboard" />} />
        <Route path="/challenges" element={<SubPageRouter page="challenges" />} />
        <Route
          path="/my-tickets"
          element={
            <FeatureFlaggedRoute flag="ticketing">
              <SubPageRouter page="my-tickets" />
            </FeatureFlaggedRoute>
          }
        />
        <Route
          path="/night-planner"
          element={
            <FeatureFlaggedRoute flag="aiConcierge">
              <SubPageRouter page="night-planner" />
            </FeatureFlaggedRoute>
          }
        />
        <Route
          path="/safety/contacts"
          element={
            <FeatureFlaggedRoute flag="safetyKit">
              <SubPageRouter page="safety-contacts" />
            </FeatureFlaggedRoute>
          }
        />

        {/* Main tabs */}
        <Route path="/discover" element={wrapTab('discover')} />
        <Route path="/map" element={wrapTab('map')} />
        <Route path="/notifications" element={wrapTab('notifications')} />
        <Route path="/profile" element={wrapTab('profile')} />
        <Route
          path="/"
          element={(
            <WelcomeRedirect>
              <TrendingHomeRoute>
                {wrapTab('tonight')}
              </TrendingHomeRoute>
            </WelcomeRedirect>
          )}
        />
        {/* Legacy social feed path — keep for deep links, not primary IA */}
        <Route path="/trending" element={wrapTab('trending')} />

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
          aria-label="Leave a live review"
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
