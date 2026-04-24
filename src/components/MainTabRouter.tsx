import { lazy, Suspense } from 'react'
import { useAppState, ALL_USERS } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { motion, AnimatePresence } from 'framer-motion'

const InteractiveMap = lazy(() => import('@/components/InteractiveMap').then(m => ({ default: m.InteractiveMap })))
const NotificationFeed = lazy(() => import('@/components/NotificationFeed').then(m => ({ default: m.NotificationFeed })))
const TrendingTab = lazy(() => import('@/components/TrendingTab').then(m => ({ default: m.TrendingTab })))
const ProfileTab = lazy(() => import('@/components/ProfileTab').then(m => ({ default: m.ProfileTab })))
const DiscoverTab = lazy(() => import('@/components/DiscoverTab').then(m => ({ default: m.DiscoverTab })))

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
    getPulsesWithUsers,
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
    handleTabChange,
  } = handlers

  if (!venues || !currentUser) return null

  return (
    <Suspense fallback={pageFallback}>
      <AnimatePresence mode="wait">
        {activeTab === 'trending' && (
          <motion.div key="trending" {...tabMotion}>
            <TrendingTab
              venues={venues}
              pulses={moderatedPulses}
              pulsesWithUsers={getPulsesWithUsers()}
              favoriteVenues={favoriteVenues}
              followedVenues={followedVenues}
              userLocation={userLocation}
              unitSystem={unitSystem}
              currentUser={currentUser}
              allUsers={ALL_USERS}
              trendingSubTab={trendingSubTab}
              onSubTabChange={setTrendingSubTab}
              onVenueClick={setSelectedVenue}
              onToggleFavorite={handleToggleFavorite}
              onToggleFollow={handleToggleFollow}
              onReaction={handleReaction}
              onReportPulse={handlePulseReport}
              isFavorite={isFavorite}
              promotions={promotions || []}
              onPromotionImpression={handlePromotionImpression}
              onPromotionClick={handlePromotionClick}
            />
          </motion.div>
        )}

        {activeTab === 'discover' && (
          <motion.div key="discover" {...tabMotion}>
            <DiscoverTab
              venues={venues}
              pulses={moderatedPulses}
              pulsesWithUsers={getPulsesWithUsers()}
              currentUser={currentUser}
              allUsers={ALL_USERS}
              stories={stories || []}
              events={events || []}
              onVenueClick={setSelectedVenue}
              onStoryClick={(storyList) => { setStoryViewerStories(storyList); setStoryViewerOpen(true) }}
              onAddFriend={handleAddFriend}
              onNavigate={(page) => setSubPage(page)}
            />
          </motion.div>
        )}

        {activeTab === 'map' && (
          <motion.div key="map" {...tabMotion} className="max-w-2xl mx-auto px-4 py-6 h-[calc(100vh-180px)]">
            <div className="h-full">
              <InteractiveMap
                venues={venues}
                userLocation={userLocation}
                onVenueClick={setSelectedVenue}
                isTracking={isTracking}
                locationAccuracy={realtimeLocation?.accuracy}
                locationHeading={realtimeLocation?.heading}
              />
            </div>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div key="notifications" {...tabMotion}>
            <NotificationFeed
              currentUser={currentUser}
              pulses={moderatedPulses}
              venues={venues}
              onNotificationClick={handleNotificationClick}
            />
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div key="profile" {...tabMotion}>
            <ProfileTab
              currentUser={currentUser}
              pulses={moderatedPulses}
              pulsesWithUsers={getPulsesWithUsers()}
              favoriteVenues={favoriteVenues}
              onVenueClick={setSelectedVenue}
              onReaction={handleReaction}
              onOpenSocialPulseDashboard={() => {
                if (!socialDashboardEnabled) { import('sonner').then(s => s.toast.error('Admin dashboard is currently unavailable')); return }
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
