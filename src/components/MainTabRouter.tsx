import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppState, ALL_USERS } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { ENERGY_CONFIG, type Venue } from '@/lib/types'
import type { EnergyFilter } from '@/components/MapFilters'
import { MapSearch } from '@/components/MapSearch'
import { MapEnergyPills } from '@/components/MapEnergyPills'
import { MapInventoryPills } from '@/components/MapInventoryPills'
import { TonightHomeHeader } from '@/components/TonightHomeHeader'
import { LivePulseTimeline } from '@/components/LivePulseTimeline'
import { FirstOpenCoach } from '@/components/FirstOpenCoach'
import { InstallAffordance } from '@/components/InstallAffordance'
import { PushNotifyAffordance } from '@/components/PushNotifyAffordance'
import {
  isPushNotifyDismissed,
  readPushNotifyTrigger,
  shouldShowPushNotifyAffordance,
  clearPushNotifyTrigger,
} from '@/lib/push-notify-affordance'
import { readViteVapidPublicKey } from '@/lib/web-push-client'
import { WRITE_AUTH_COPY } from '@/lib/guest-discovery'
import { MapHomeSkeleton } from '@/components/MapHomeSkeleton'
import type { MapHomeSurface } from '@/lib/ux-chrome'
import { markNavigationStart, partitionColdStartCatalog, scheduleAllSeattleRelease } from '@/lib/cold-start'
import { prefersReducedMotion } from '@/lib/accessibility'
import { dismissFirstOpenCoach, shouldShowFirstOpenCoach } from '@/lib/first-open-coach'
import { shareVenueFromSurface } from '@/lib/sharing'
import { getEnergyLabel } from '@/lib/pulse-engine'
import { getSurgingNearbyVenues, getVenueMapActivity } from '@/lib/map-live-reviews'
import { SignalPill } from '@/components/ux/SignalPill'
import { toneForEnergy } from '@/lib/signal-tone'
import { evaluateLocalNightCoach } from '@/lib/local-night-coach'
import { listCatalogEvents } from '@/lib/data/events'
import type { CatalogEvent } from '@/lib/events-tonight'
import { DoorPinData, FollowData, PulseAgreeData, PulseReplyData, USE_SUPABASE_BACKEND } from '@/lib/data'
import { listLastNightRooms } from '@/lib/last-night'
import type { PulseReply } from '@/lib/pulse-thread'
import type { PulseAgree } from '@/lib/pulse-same'
import { lastNightAuthPath } from '@/lib/last-night'
import { buildAuthPath } from '@/lib/auth-return-intent'
import { venueComposePath } from '@/lib/auth-return-intent'
import { listRecentVenues, readRecentVenueIds } from '@/lib/recent-venues'
import {
  findImHereVenue,
  inventoryLayerForImHere,
  parseHereVenueId,
  resolveImHereAction,
  resolveImHereOpen,
  retainFocusedVenue,
  wantsImHereCreate,
} from '@/lib/im-here'
import { funnelActor, trackFunnel } from '@/lib/funnel-events'
import type { MapInventoryLayer } from '@/lib/map-filters'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { cn } from '@/lib/utils'

const InteractiveMap = lazy(() => import('@/components/InteractiveMap').then(m => ({ default: m.InteractiveMap })))
const NotificationFeed = lazy(() => import('@/components/NotificationFeed').then(m => ({ default: m.NotificationFeed })))
const TrendingTab = lazy(() => import('@/components/TrendingTab').then(m => ({ default: m.TrendingTab })))
const ProfileTab = lazy(() => import('@/components/ProfileTab').then(m => ({ default: m.ProfileTab })))
const DiscoverTab = lazy(() => import('@/components/DiscoverTab').then(m => ({ default: m.DiscoverTab })))
const SurgingNearbyList = lazy(() => import('@/components/SurgingNearbyList').then(m => ({ default: m.SurgingNearbyList })))

const pageFallback = <MapHomeSkeleton />

function tabMotionFor(reduced: boolean) {
  if (reduced) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 1 },
      transition: { duration: 0 },
    }
  }
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.2 },
  }
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
    notifications,
    setNotifications,
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
    handleHidePulse,
    handlePinMyNight,
    handlePulseReply,
    handleSameAgree,
    handleBlockUser,
  } = handlers

  // Card taps set selectedVenue (for state consumers) and route to the venue
  // detail page. AppRoutes renders VenuePage only via the /venue/:id route, so
  // navigation — not just state — is what opens the page.
  const navigate = useNavigate()
  const location = useLocation()
  const { session, isPlaceholder } = useSupabaseAuth()
  const signedIn = Boolean(session) && !isPlaceholder
  const [showPushNotify, setShowPushNotify] = useState(false)
  const [catalogEvents, setCatalogEvents] = useState<CatalogEvent[]>([])
  const [pinnedVenueIds, setPinnedVenueIds] = useState<string[]>([])
  const [recentVenueIds, setRecentVenueIds] = useState<string[]>(() => readRecentVenueIds())
  const [tonightReplies, setTonightReplies] = useState<PulseReply[]>([])
  const [tonightAgrees, setTonightAgrees] = useState<PulseAgree[]>([])
  const [lastNightPresence, setLastNightPresence] = useState<{ venueId: string; userId: string; checkedInAt: string }[]>([])

  useEffect(() => {
    setShowPushNotify(shouldShowPushNotifyAffordance({
      signedIn,
      vapidPublicKey: readViteVapidPublicKey(),
      dismissed: isPushNotifyDismissed(),
      trigger: readPushNotifyTrigger(),
    }))
  }, [followedVenues, signedIn])

  useEffect(() => {
    if (!USE_SUPABASE_BACKEND) return
    void listCatalogEvents().then(setCatalogEvents).catch(() => setCatalogEvents([]))
    if (signedIn && currentUser?.id) {
      void FollowData.listPinnedVenues(currentUser.id).then(setPinnedVenueIds).catch(() => setPinnedVenueIds([]))
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      void DoorPinData.listMyPresenceLastNight(currentUser.id, since)
        .then(setLastNightPresence)
        .catch(() => setLastNightPresence([]))
    }
    const pulseIds = moderatedPulses.slice(0, 40).map((pulse) => pulse.id)
    void PulseAgreeData.listAgreesForPulses(pulseIds).then(setTonightAgrees).catch(() => setTonightAgrees([]))
    const venueIds = [...new Set(visibleVenues.slice(0, 12).map((venue) => venue.id))]
    void Promise.all(venueIds.map((id) => PulseReplyData.listRepliesForVenue(id)))
      .then((rows) => setTonightReplies(rows.flat()))
      .catch(() => setTonightReplies([]))
  }, [currentUser?.id, moderatedPulses, signedIn, visibleVenues])

  useEffect(() => {
    if (!signedIn) return
    const note = evaluateLocalNightCoach({
      venues: venues ?? [],
      pulses: moderatedPulses,
      followedVenueIds: followedVenues.map((venue) => venue.id),
    })
    if (!note) return
    toast.message(note.title, { description: note.body })
  }, [followedVenues, moderatedPulses, signedIn, venues])
  useEffect(() => {
    setRecentVenueIds(readRecentVenueIds())
  }, [location.pathname])

  const lastNight = useMemo(
    () => signedIn && currentUser
      ? listLastNightRooms({
        venues: venues ?? [],
        pulses: moderatedPulses,
        userId: currentUser.id,
        pinnedVenueIds,
        presence: lastNightPresence,
      })
      : [],
    [currentUser, lastNightPresence, moderatedPulses, pinnedVenueIds, signedIn, venues],
  )

  const recentVenues = useMemo(
    () => listRecentVenues(venues ?? [], recentVenueIds),
    [recentVenueIds, venues],
  )

  const hereVenueId = parseHereVenueId(location.search)
  const [allSeattleReady, setAllSeattleReady] = useState(false)
  const tabMotion = tabMotionFor(prefersReducedMotion())
  const mapVenues = useMemo(() => {
    const focused = retainFocusedVenue(visibleVenues, venues, hereVenueId)
    if (allSeattleReady) return focused
    return retainFocusedVenue(partitionColdStartCatalog(focused).launch, venues, hereVenueId)
  }, [allSeattleReady, hereVenueId, venues, visibleVenues])
  const tonightVenues = useMemo(
    () => (allSeattleReady ? visibleVenues : partitionColdStartCatalog(visibleVenues).launch),
    [allSeattleReady, visibleVenues],
  )
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
  const [showFirstOpenCoach, setShowFirstOpenCoach] = useState(() => shouldShowFirstOpenCoach())
  const [surgingReady, setSurgingReady] = useState(false)
  const [mapSurface, setMapSurface] = useState<MapHomeSurface>('map')
  useEffect(() => {
    const lift = activeTab === 'map' && mapSurface === 'map'
    document.documentElement.toggleAttribute('data-compose-lift', lift)
    return () => document.documentElement.removeAttribute('data-compose-lift')
  }, [activeTab, mapSurface])
  const mapFloatVenue = useMemo(() => {
    if (hereVenueId) {
      const focused = mapVenues.find((venue) => venue.id === hereVenueId)
      if (focused) return focused
    }
    const surging = getSurgingNearbyVenues(visibleVenues, visiblePulses, {
      userLocation,
      limit: 1,
    })
    if (surging[0]) return surging[0]
    return [...visibleVenues].sort((a, b) => b.pulseScore - a.pulseScore)[0] ?? null
  }, [hereVenueId, mapVenues, userLocation, visiblePulses, visibleVenues])
  const mapFloatEnergy = useMemo(() => {
    if (!mapFloatVenue) return null
    const activity = getVenueMapActivity(mapFloatVenue, visiblePulses)
    if (activity.latest) {
      return {
        tone: toneForEnergy(activity.latest.energyRating),
        label: ENERGY_CONFIG[activity.latest.energyRating].label,
      }
    }
    const label = getEnergyLabel(mapFloatVenue.pulseScore)
    return { tone: toneForEnergy(label.toLowerCase()), label }
  }, [mapFloatVenue, visiblePulses])

  useEffect(() => {
    markNavigationStart()
  }, [])

  useEffect(() => {
    if (activeTab !== 'map') return
    const { guest } = funnelActor({ hasSession: Boolean(session), isPlaceholder })
    trackFunnel('guest_map_view', { guest })
  }, [activeTab, isPlaceholder, session])

  const openedHereRef = useRef<{ venueId: string; created: boolean } | null>(null)
  useEffect(() => {
    if (!hereVenueId) return
    if (!venues?.length) return
    const venue = findImHereVenue(venues, hereVenueId)
    if (!venue) return
    const action = resolveImHereAction({
      venueId: hereVenueId,
      isPlaceholder,
      hasSession: Boolean(session),
    })
    const openCreate = action.openCreate || (
      wantsImHereCreate(location.search) && action.authRedirect === null
    )
    const already = openedHereRef.current
    const next = resolveImHereOpen({
      alreadyOpenedVenueId: already?.venueId ?? null,
      alreadyOpenedCreate: already?.created ?? false,
      venueId: hereVenueId,
      openCreate,
    })
    if (next.focus) {
      setInventoryLayer((current) => inventoryLayerForImHere(venue, current))
      setSelectedVenue(venue)
    }
    if (next.create) handleCreatePulse(hereVenueId)
    if (next.focus || next.create) {
      openedHereRef.current = {
        venueId: hereVenueId,
        created: Boolean(already?.created || next.create),
      }
    }
  }, [handleCreatePulse, hereVenueId, isPlaceholder, location.search, session, setSelectedVenue, venues])

  useEffect(() => scheduleAllSeattleRelease(() => {
    setAllSeattleReady(true)
    setSurgingReady(true)
  }), [])

  const handleMapPinClick = useCallback((venue: Venue) => {
    handleCreatePulse(venue.id)
  }, [handleCreatePulse])

  const handleBeFirstPulse = useCallback((venue: Venue) => {
    handleCreatePulse(venue.id)
  }, [handleCreatePulse])

  const handleShareVenue = useCallback((venue: Venue) => {
    void shareVenueFromSurface(venue).then((result) => {
      if (result === 'copied') toast.success('Link copied')
    })
  }, [])

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
          <>
          <motion.div
            key="map"
            {...tabMotion}
            className={cn(
              'mx-auto max-w-2xl px-4',
              mapSurface === 'map'
                ? 'flex flex-col gap-2 pb-[calc(13rem+env(safe-area-inset-bottom,0px))] pt-3'
                : 'space-y-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-6',
            )}
          >
            <TonightHomeHeader
              venues={tonightVenues}
              pulses={visiblePulses}
              userLocation={userLocation}
              savedVenueIds={favoriteVenues.map((venue) => venue.id)}
              followedVenueIds={followedVenues.map((venue) => venue.id)}
              pinnedVenueIds={pinnedVenueIds}
              followedUserIds={currentUser.friends ?? []}
              catalogEvents={catalogEvents}
              recentVenues={recentVenues}
              signedIn={signedIn}
              locationDenied={!userLocation}
              onVenueClick={handleVenueClick}
              onToggleFollow={handleToggleFollow}
              onShareVenue={handleShareVenue}
              onHidePulse={handleHidePulse}
              onPinMyNight={handlePinMyNight}
              onBeFirstPulse={(venue) => {
                if (!signedIn) {
                  navigate(buildAuthPath(venueComposePath(venue.id)))
                  return
                }
                handleCreatePulse(venue.id)
              }}
              onFollowAuth={() => {
                toast.error(WRITE_AUTH_COPY.follow.title, { description: WRITE_AUTH_COPY.follow.description })
                navigate(buildAuthPath(`${location.pathname}${location.search}`))
              }}
              surface={mapSurface}
              onSurfaceChange={setMapSurface}
              viewerId={currentUser.id}
              replies={tonightReplies}
              agrees={tonightAgrees}
              lastNightRooms={lastNight}
              onLastNightAuth={() => navigate(lastNightAuthPath())}
              onPulseReply={handlePulseReply}
              onSameAgree={handleSameAgree}
              onBlockUser={handleBlockUser}
            />
            {mapSurface === 'live' && (
              <LivePulseTimeline
                pulses={visiblePulsesWithUsers}
                venues={visibleVenues}
                onVenueClick={handleVenueClick}
                onBeFirstPulse={handleBeFirstPulse}
                onShareVenue={handleShareVenue}
              />
            )}
            {mapSurface === 'map' && (
              <>
                <div className="flex shrink-0 flex-col gap-2">
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
                </div>
                <div className="relative h-[46vh] min-h-[300px] shrink-0" role="region" aria-labelledby="tonight-home-heading">
                  <div className="absolute inset-0 overflow-hidden rounded-[20px] bg-[#080a0f]">
                  <InteractiveMap
                    venues={mapVenues}
                    userLocation={userLocation}
                    onVenueClick={handleMapPinClick}
                    onShareVenue={handleShareVenue}
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
                  {mapFloatVenue && mapFloatEnergy && (
                    <button
                      type="button"
                      onClick={() => handleVenueClick(mapFloatVenue)}
                      className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-[#1a1c21] py-2 pl-3 pr-2.5 shadow-lg"
                    >
                      <span className="max-w-[140px] truncate text-[12px] font-semibold text-foreground">{mapFloatVenue.name}</span>
                      <SignalPill tone={mapFloatEnergy.tone}>{mapFloatEnergy.label}</SignalPill>
                    </button>
                  )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                {showFirstOpenCoach && (
                  <FirstOpenCoach
                    onDismiss={() => {
                      dismissFirstOpenCoach()
                      setShowFirstOpenCoach(false)
                    }}
                  />
                )}
                <InstallAffordance
                  onInstalled={() => {
                    if (signedIn) setShowPushNotify(true)
                  }}
                />
                {showPushNotify && signedIn && (
                  <PushNotifyAffordance
                    userLocation={userLocation}
                    onDone={() => {
                      clearPushNotifyTrigger()
                      setShowPushNotify(false)
                    }}
                  />
                )}
                </div>
                {!surgingReady && (
                  <div className="h-16 shrink-0 animate-pulse rounded-lg bg-muted" aria-hidden />
                )}
              </>
            )}
          </motion.div>
          {mapSurface === 'map' && surgingReady && (
            <div className="fixed inset-x-0 z-30 mx-auto w-full max-w-2xl bg-background px-4 pt-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]">
              <div className="max-h-[7.5rem] overflow-y-auto">
                <SurgingNearbyList
                  venues={visibleVenues}
                  pulses={visiblePulses}
                  userLocation={userLocation}
                  unitSystem={unitSystem}
                  onVenueClick={handleVenueClick}
                  onBeFirstPulse={handleBeFirstPulse}
                  onShareVenue={handleShareVenue}
                />
              </div>
            </div>
          )}
          </>
        )}

        {activeTab === 'notifications' && (
          <motion.div key="notifications" {...tabMotion}>
            <NotificationFeed
              currentUser={currentUser}
              pulses={visiblePulses}
              venues={visibleVenues}
              notifications={notifications}
              onNotificationsChange={setNotifications}
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
