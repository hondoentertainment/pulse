import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppState } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { BottomNav } from '@/components/BottomNav'
import { useRouteNavigation } from '@/hooks/use-route-navigation'
import { usePulse } from '@/hooks/api/use-pulses'
import { PulseCard } from '@/components/PulseCard'
import { Button } from '@/components/ui/button'
import { PageSkeleton } from '@/components/PageSkeleton'
import { ArrowLeft, MapPin, WifiSlash } from '@phosphor-icons/react'
import type { PulseWithUser } from '@/lib/types'

const pageFallback = <PageSkeleton variant="detail" label="Loading pulse" />

export function PulseRoute() {
  const { pulseId } = useParams<{ pulseId: string }>()
  const navigate = useNavigate()
  const { activeTab, navigateToTab, navigateToVenue } = useRouteNavigation()
  const state = useAppState()
  const handlers = useAppHandlers()
  const pulseQuery = usePulse(pulseId)

  const {
    venues,
    currentUser,
    unreadNotificationCount,
    resolvePulseUser,
    getPulsesWithUsers,
  } = state

  const { handleReaction, handlePulseReport } = handlers

  const cachedPulse = useMemo(() => {
    if (!pulseId) return null
    return getPulsesWithUsers().find((pulse) => pulse.id === pulseId) ?? null
  }, [getPulsesWithUsers, pulseId])

  const pulseWithUser: PulseWithUser | null = useMemo(() => {
    if (cachedPulse) return cachedPulse
    const pulse = pulseQuery.data
    if (!pulse || !currentUser || !venues) return null
    const venue = venues.find((item) => item.id === pulse.venueId)
    if (!venue) return null
    return {
      ...pulse,
      user: resolvePulseUser(pulse.userId),
      venue,
    }
  }, [cachedPulse, currentUser, pulseQuery.data, resolvePulseUser, venues])

  if (!currentUser || !venues || !pulseId) return null

  if (pulseQuery.isLoading && !pulseWithUser) {
    return pageFallback
  }

  // Surface fetch failures with a retry affordance instead of silently
  // collapsing into the generic "not found" state.
  if (pulseQuery.isError && !pulseWithUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4 px-6 text-center">
        <WifiSlash size={40} weight="fill" className="text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold">Couldn’t load this pulse</p>
          <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => pulseQuery.refetch()}>Retry</Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to trending
          </Button>
        </div>
      </div>
    )
  }

  if (!pulseWithUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4 px-6 text-center">
        <p className="text-muted-foreground">Pulse not found or expired</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to trending
        </Button>
      </div>
    )
  }

  const relatedPulses = getPulsesWithUsers().filter((pulse) => pulse.venueId === pulseWithUser.venueId)

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeft size={20} weight="bold" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{pulseWithUser.venue.name}</p>
              <p className="truncate text-xs text-muted-foreground">Pulse detail</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToVenue(pulseWithUser.venue)}
            >
              <MapPin size={16} className="mr-1" />
              Venue
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 py-6">
          <PulseCard
            pulse={pulseWithUser}
            allPulses={relatedPulses}
            onReaction={(type) => handleReaction(pulseWithUser.id, type)}
            currentUserId={currentUser.id}
            onReport={handlePulseReport}
            venueName={pulseWithUser.venue.name}
          />
        </div>
      </div>

      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => navigateToTab(tab)}
        unreadNotifications={unreadNotificationCount}
      />
    </>
  )
}

/** Lazy export for route registration. */
export default PulseRoute
