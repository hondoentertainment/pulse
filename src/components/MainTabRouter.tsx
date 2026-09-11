import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppState, ALL_USERS } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { Venue } from '@/lib/types'
import type { EnergyFilter } from '@/components/MapFilters'
import { MapSearch } from '@/components/MapSearch'
import { MapEnergyPills } from '@/components/MapEnergyPills'
import { MapInventoryPills } from '@/components/MapInventoryPills'
import { TonightHomeHeader } from '@/components/TonightHomeHeader'
import { ColdStartTip } from '@/components/ColdStartTip'
import { InstallAffordance } from '@/components/InstallAffordance'
import { MapHomeSkeleton } from '@/components/MapHomeSkeleton'
import { dismissColdStartTip, markNavigationStart, shouldShowColdStartTip } from '@/lib/cold-start'
import { parseHereVenueId } from '@/lib/im-here'
import { track } from '@/lib/observability/analytics'
import type { MapInventoryLayer } from '@/lib/map-filters'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'

const InteractiveMap = lazy(() => import('@/components/InteractiveMap').then(m => ({ default: m.InteractiveMap })))
const NotificationFeed = lazy(() => import('@/components/NotificationFeed').then(m => ({ default: m.NotificationFeed })))
const TrendingTab = lazy(() => import('@/components/TrendingTab').then(m => ({ default: m.TrendingTab })))
const ProfileTab = lazy(() => import('@/components/ProfileTab').then(m => ({ default: m.ProfileTab })))
const DiscoverTab = lazy(() => import('@/components/DiscoverTab').then(m => ({ default: m.DiscoverTab })))
const SurgingNearbyList = lazy(() => import('@/components/SurgingNearbyList').then(m => ({ default: m.SurgingNearbyList })))

const pageFallback = <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>

const tabMotion = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.2 },
}

export function MainTabRouter() {
  const state = useAppState()
  const handlers = useAppHandlers()
  const {
    activeTab,
    venues,
    visibleVenues,
    moderatedPulses,
    currentUser,
    stories,
    events,
    favoriteVenues,
    followedVenues,
    userLocation,
    unitSystem,
    trendingSubTab,
    setTrendingSubTab,
    setSelectedVenue,
    setSubPage,
    realtimeLocation,
    isTracking,
    promotions,
    socialDashboardEnabled,
    setShowAdminDashboard,
    setStoryViewerOpen,
    setStoryViewerStories,
    isFavorite,
    isFollowed,
    pulsesWithUsers,
  } = state

  const {
    handleReaction,
    handleToggleFavorite,
    handleToggleFollow,
    handleNotificationClick,
    handleAddFriend,
    handlePulseReport,
    handlePromotionImpression,
    handlePromotionClick,
    handleCreatePulse,
  } = handlers

  // Card taps set selectedVenue (for state consumers) and route to the venue
  // detail page. AppRoutes renders VenuePage only via the /venue/:id route, so
  // navigation — not just state — is what opens the page.
  const navigate = useNavigate()
  const location = useLocation()
  const { session, isPlaceholder } = useSupabaseAuth()
  const hereVenueId = parseHereVenueId(location.search)
  const handleVenueClick = useCallback(
    (venue: Venue) => {
      setSelectedVenue(venue)
      navigate(`/venue/${venue.id}`)
    },
    [navigate, setSelectedVenue],
  )

  const visibleVenueIds = useMemo(
    () => new Set(visibleVenues.map(venue => venue.id)),
    [visibleVenues]
  )
  const visiblePulses = useMemo(
    () => moderatedPulses.filter(pulse => visibleVenueIds.has(pulse.venueId)),
    [moderatedPulses, visibleVenueIds]
  )
  const visiblePulsesWithUsers = useMemo(
    () => pulsesWithUsers.filter(pulse => visibleVenueIds.has(pulse.venueId)),
    [pulsesWithUsers, visibleVenueIds]
  )

  const [mapEnergyLevels, setMapEnergyLevels] = useState<EnergyFilter[]>([])
  const [mapNearMe, setMapNearMe] = useState(false)
  const [inventoryLayer, setInventoryLayer] = useState<MapInventoryLayer>('curated')
  const [showColdStart, setShowColdStart] = useState(() => shouldShowColdStartTip())
  const [surgingReady, setSurgingReady] = useState(false)

  useEffect(() => {
    markNavigationStart()
  }, [])

  useEffect(() => {
    if (activeTab !== 'map') return
    track('funnel_step', { step: 'guest_map', guest: !session && !isPlaceholder })
  }, [activeTab, isPlaceholder, session])

  const openedHereRef = useRef<string | null>(null)
  useEffect(() => {
    if (!hereVenueId || openedHereRef.current === hereVenueId) return
    openedHereRef.current = hereVenueId
    const venue = visibleVenues.find((item) => item.id === hereVenueId)
    if (venue) setSelectedVenue(venue)
    if (session || isPlaceholder) {
      handleCreatePulse(hereVenueId)
    }
  }, [handleCreatePulse, hereVenueId, isPlaceholder, session, setSelectedVenue, visibleVenues])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const idle = window.requestIdleCallback
      ?? ((cb: () => void) => window.setTimeout(cb, 400))
    const id = idle(() => setSurgingReady(true))
    return () => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(id as number)
      else window.clearTimeout(id as number)
    }
  }, [])

  const handleMapPinClick = useCallback((venue: Venue) => {
    handleCreatePulse(venue.id)
  }, [handleCreatePulse])

  if (!venues || !currentUser) return <MapHomeSkeleton />

  return (
    <Suspense fallback={pageFallback}>
      <AnimatePresence mode="wait">
        {activeTab === 'trending' && (
          <motion.div key="trending" {...tabMotion}>
            <TrendingTab
              venues={visibleVenues}
              pulses={visiblePulses}
              pulsesWithUsers={pulsesWithUsers}
              favoriteVenues={favoriteVenues}
              followedVenues={followedVenues}
              userLocation={userLocation}
              unitSystem={unitSystem}
              currentUser={currentUser}
              allUsers={ALL_USERS}
              trendingSubTab={trendingSubTab}
              onSubTabChange={setTrendingSubTab}
              onVenueClick={handleVenueClick}
              onToggleFavorite={handleToggleFavorite}
              onToggleFollow={handleToggleFollow}
              onReaction={handleReaction}
              onReportPulse={handlePulseReport}
              isFavorite={isFavorite}
              isFollowed={isFollowed}
              promotions={promotions || []}
              onPromotionImpression={handlePromotionImpression}
              onPromotionClick={handlePromotionClick}
            />
          </motion.div>
        )}

        {activeTab === 'discover' && (
          <motion.div key="discover" {...tabMotion}>
            <DiscoverTab
              venues={visibleVenues}
              pulses={visiblePulses}
              pulsesWithUsers={visiblePulsesWithUsers}
              currentUser={currentUser}
              allUsers={ALL_USERS}
              stories={stories || []}
              events={events || []}
              userLocation={userLocation}
              onVenueClick={handleVenueClick}
              onStoryClick={(storyList) => { setStoryViewerStories(storyList); setStoryViewerOpen(true) }}
              onAddFriend={handleAddFriend}
              onNavigate={(page) => setSubPage(page)}
              isFollowed={isFollowed}
              onToggleFollow={handleToggleFollow}
            />
          </motion.div>
        )}

        {activeTab === 'map' && (
          <motion.div key="map" {...tabMotion} className="mx-auto max-w-2xl space-y-3.5 px-5 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-8">
            <TonightHomeHeader
              venues={visibleVenues}
              pulses={visiblePulses}
              userLocation={userLocation}
              savedVenueIds={favoriteVenues.map((venue) => venue.id)}
              locationDenied={!userLocation}
              onVenueClick={handleVenueClick}
            />
            {showColdStart && (
              <ColdStartTip
                onDismiss={() => {
                  dismissColdStartTip()
                  setShowColdStart(false)
                }}
              />
            )}
            <InstallAffordance />
            <MapSearch
              venues={visibleVenues}
              onVenueSelect={handleVenueClick}
              userLocation={userLocation}
              compact
            />
            <MapInventoryPills
              inventoryLayer={inventoryLayer}
              nearMeActive={mapNearMe}
              onInventoryLayerChange={setInventoryLayer}
              onToggleNearMe={() => setMapNearMe((current) => !current)}
            />
            <MapEnergyPills
              energyLevels={mapEnergyLevels}
              nearMeActive={mapNearMe}
              onToggleEnergy={(level) => {
                setMapEnergyLevels((current) => (
                  current.includes(level)
                    ? current.filter((item) => item !== level)
                    : [...current, level]
                ))
              }}
              onToggleNearMe={() => setMapNearMe((current) => !current)}
            />
            <div className="h-[300px] overflow-hidden rounded-[20px] bg-[#12141A]" role="region" aria-labelledby="tonight-home-heading">
              <InteractiveMap
                venues={visibleVenues}
                userLocation={userLocation}
                onVenueClick={handleMapPinClick}
                isTracking={isTracking}
                locationAccuracy={realtimeLocation?.accuracy}
                locationHeading={realtimeLocation?.heading}
                pulses={visiblePulses}
                chrome="heatmap"
                energyLevels={mapEnergyLevels}
                onEnergyLevelsChange={setMapEnergyLevels}
                nearMe={mapNearMe}
                onNearMeChange={setMapNearMe}
                inventoryLayer={inventoryLayer}
                onInventoryLayerChange={setInventoryLayer}
                focusVenueId={hereVenueId}
              />
            </div>
            {surgingReady ? (
              <SurgingNearbyList
                venues={visibleVenues}
                pulses={visiblePulses}
                userLocation={userLocation}
                unitSystem={unitSystem}
                onVenueClick={handleVenueClick}
              />
            ) : (
              <div className="h-16 animate-pulse rounded-[18px] bg-[#1F1F24]" aria-hidden />
            )}
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div key="notifications" {...tabMotion}>
            <NotificationFeed
              currentUser={currentUser}
              pulses={visiblePulses}
              venues={visibleVenues}
              onNotificationClick={handleNotificationClick}
            />
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div key="profile" {...tabMotion}>
            <ProfileTab
              currentUser={currentUser}
              pulses={moderatedPulses}
              pulsesWithUsers={pulsesWithUsers}
              favoriteVenues={favoriteVenues}
              onVenueClick={handleVenueClick}
              onReaction={handleReaction}
              onOpenSocialPulseDashboard={() => {
                if (!socialDashboardEnabled) { toast.error('Admin dashboard is currently unavailable'); return }
                setShowAdminDashboard(true)
              }}
              onOpenSettings={() => setSubPage('settings')}
              onOpenOwnerDashboard={() => {
                setSubPage('owner-dashboard')
              }}
              onOpenModerationQueue={() => setSubPage('moderation')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Suspense>
  )
}
