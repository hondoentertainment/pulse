import { useNavigate, useLocation } from 'react-router-dom'
import { useCallback } from 'react'
import type { TabId } from '@/components/BottomNav'
import type { SubPage } from '@/hooks/use-app-state'
import type { Venue } from '@/lib/types'

const TAB_TO_PATH: Record<TabId, string> = {
  trending: '/',
  discover: '/discover',
  map: '/map',
  notifications: '/notifications',
  profile: '/profile',
  video: '/video',
}

const SUBPAGE_TO_PATH: Record<NonNullable<SubPage>, string> = {
  events: '/events',
  crews: '/crews',
  achievements: '/achievements',
  insights: '/insights',
  neighborhoods: '/neighborhoods',
  playlists: '/playlists',
  settings: '/settings',
  integrations: '/integrations',
  moderation: '/moderation',
  challenges: '/challenges',
  'my-tickets': '/my-tickets',
  'night-planner': '/night-planner',
}

const PATH_TO_TAB: Record<string, TabId> = {
  '/': 'trending',
  '/discover': 'discover',
  '/map': 'map',
  '/notifications': 'notifications',
  '/profile': 'profile',
  '/video': 'video',
}

/** Derive the active tab ID from the current URL pathname */
export function deriveActiveTab(pathname: string): TabId {
  if (PATH_TO_TAB[pathname]) return PATH_TO_TAB[pathname]
  // Default to trending for sub-pages and unknown paths
  return 'trending'
}

export function useRouteNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  const activeTab = deriveActiveTab(location.pathname)

  const navigateToTab = useCallback(
    (tab: TabId) => {
      navigate(TAB_TO_PATH[tab])
    },
    [navigate],
  )

  const navigateToSubPage = useCallback(
    (page: NonNullable<SubPage>) => {
      const path = SUBPAGE_TO_PATH[page]
      if (path) navigate(path)
    },
    [navigate],
  )

  const navigateToVenue = useCallback(
    (venue: Venue) => {
      navigate(`/venue/${venue.id}`)
    },
    [navigate],
  )

  const navigateBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  return {
    activeTab,
    navigateToTab,
    navigateToSubPage,
    navigateToVenue,
    navigateBack,
    navigate,
    location,
  }
}
