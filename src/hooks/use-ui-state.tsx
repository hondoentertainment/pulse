import { createContext, useContext } from 'react'
import type { Venue } from '@/lib/types'
import { PulseStory } from '@/lib/stories'
import type { TabId } from '@/components/BottomNav'

export type SubPage =
  | 'events'
  | 'crews'
  | 'achievements'
  | 'insights'
  | 'neighborhoods'
  | 'playlists'
  | 'settings'
  | 'integrations'
  | 'moderation'
  | 'challenges'
  | 'my-tickets'
  | 'night-planner'
  | null

export interface UIState {
  // Navigation
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  selectedVenue: Venue | null
  setSelectedVenue: (v: Venue | null) => void
  subPage: SubPage
  setSubPage: (p: SubPage) => void

  // Onboarding
  hasCompletedOnboarding: boolean | undefined
  setHasCompletedOnboarding: (v: boolean) => void

  // Feature flags
  integrationsEnabled: boolean
  socialDashboardEnabled: boolean

  // UI state
  createDialogOpen: boolean
  setCreateDialogOpen: (v: boolean) => void
  venueForPulse: Venue | null
  setVenueForPulse: (v: Venue | null) => void
  showAdminDashboard: boolean
  setShowAdminDashboard: (v: boolean) => void
  trendingSubTab: 'trending' | 'my-spots'
  setTrendingSubTab: (v: 'trending' | 'my-spots') => void
  storyViewerOpen: boolean
  setStoryViewerOpen: (v: boolean) => void
  storyViewerStories: PulseStory[]
  setStoryViewerStories: (v: PulseStory[]) => void
  integrationVenue: Venue | null
  setIntegrationVenue: (v: Venue | null) => void
  presenceSheetOpen: boolean
  setPresenceSheetOpen: (v: boolean) => void
  queuedPulseCount: number
  setQueuedPulseCount: (v: number) => void
}

export const UIContext = createContext<UIState | null>(null)

export function useUIState(): UIState {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUIState must be used within UIProvider')
  return ctx
}
