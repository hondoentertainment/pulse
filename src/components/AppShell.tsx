import { ReactNode } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { CreatePulseDialog } from '@/components/CreatePulseDialog'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { useOfflineCache } from '@/hooks/use-offline-cache'
import { Plus } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { Venue } from '@/lib/types'
import type { AppState } from '@/hooks/use-app-state'
import type { AppHandlers } from '@/hooks/use-app-handlers'

interface AppShellProps {
  state: AppState
  handlers: AppHandlers
  sortedVenues: Venue[]
  children: ReactNode
}

export function AppShell({ state, handlers, sortedVenues, children }: AppShellProps) {
  const {
    locationName,
    isTracking,
    realtimeLocation,
    locationPermissionDenied,
    currentTime,
    activeTab,
    createDialogOpen,
    setCreateDialogOpen,
    venueForPulse,
    unreadNotificationCount,
  } = state

  const {
    handleTabChange,
    handleSubmitPulse,
    handleCreatePulse,
  } = handlers

  const offlineCache = useOfflineCache(
    sortedVenues,
    realtimeLocation ? { lat: realtimeLocation.lat, lng: realtimeLocation.lng } : null,
    state.currentUser?.favoriteVenues ?? [],
    state.currentUser?.followedVenues ?? [],
  )

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader
        locationName={locationName}
        isTracking={isTracking}
        hasRealtimeLocation={!!realtimeLocation}
        locationPermissionDenied={locationPermissionDenied}
        currentTime={currentTime}
      />

      <OfflineIndicator
        isOnline={offlineCache.isOnline}
        lastSyncTime={offlineCache.lastSyncTime}
        syncProgress={offlineCache.syncProgress}
        cacheStats={offlineCache.cacheStats}
        onClearCache={offlineCache.clearCache}
        onRefreshCache={offlineCache.forcePrefetch}
      />

      {children}

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} unreadNotifications={unreadNotificationCount} />
      <CreatePulseDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        venue={venueForPulse}
        onSubmit={handleSubmitPulse}
      />

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (sortedVenues.length > 0) {
            handleCreatePulse(sortedVenues[0].id)
          }
        }}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/50 flex items-center justify-center z-40"
        style={{
          boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)'
        }}
      >
        <Plus size={28} weight="bold" />
      </motion.button>
    </div>
  )
}
