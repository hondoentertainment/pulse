import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ALL_USERS, useAppState } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { BottomNav } from '@/components/BottomNav'
import { useRouteNavigation } from '@/hooks/use-route-navigation'
import { USE_SUPABASE_BACKEND, VenueData, CheckInData } from '@/lib/data'
import { useVenuePulsesInfinite } from '@/hooks/api/use-pulses'
import { AuthRequiredError } from '@/lib/auth/require-auth'
import { RlsDeniedError } from '@/lib/auth/rls-helpers'
import { calculatePresence } from '@/lib/presence-engine'
import { buildPresenceUserLocations } from '@/lib/presence-context'
import { PageSkeleton } from '@/components/PageSkeleton'
import type { Pulse, PulseWithUser, Venue } from '@/lib/types'
import { toast } from 'sonner'

const VenuePage = lazy(() => import('@/components/VenuePage').then(m => ({ default: m.VenuePage })))
const PresenceSheet = lazy(() => import('@/components/PresenceSheet').then(m => ({ default: m.PresenceSheet })))

const pageFallback = <PageSkeleton variant="detail" label="Loading venue" />

export function VenueRoute() {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()
  const { activeTab, navigateToTab } = useRouteNavigation()
  const state = useAppState()
  const handlers = useAppHandlers()
  const { updateProfile } = useSupabaseAuth()

  const {
    venues,
    currentUser,
    moderatedPulses: _moderatedPulses,
    unitSystem,
    locationName,
    isTracking,
    realtimeLocation,
    userLocation,
    unreadNotificationCount,
    isFavorite,
    isFollowed,
    integrationsEnabled,
    resolvePulseUser,
    getPulsesWithUsers,
    presenceSheetOpen,
    setPresenceSheetOpen,
    setIntegrationVenue,
    setSubPage: _setSubPage,
    venueHighlights,
    pulses,
  } = state

  const {
    handleCreatePulse,
    handleReaction,
    handlePulseReport,
    handleToggleFavorite,
    handleToggleFollow,
    handleStartCrewCheckIn,
  } = handlers

  // Live venue row + paginated pulses when Supabase backend is on.
  const [freshVenue, setFreshVenue] = useState<Venue | null>(null)
  const [venueFetchFailed, setVenueFetchFailed] = useState(false)
  const [refetchKey, setRefetchKey] = useState(0)

  const venuePulseQuery = useVenuePulsesInfinite(
    USE_SUPABASE_BACKEND ? venueId : undefined,
    30,
  )

  const serverPulseList: Pulse[] | null = useMemo(() => {
    if (!USE_SUPABASE_BACKEND || !venuePulseQuery.isSuccess) return null
    return venuePulseQuery.data?.pages.flatMap(p => p.items) ?? []
  }, [venuePulseQuery.data?.pages, venuePulseQuery.isSuccess])

  useEffect(() => {
    if (!USE_SUPABASE_BACKEND || !venueId) return
    let cancelled = false
    setVenueFetchFailed(false)

    ;(async () => {
      try {
        const venue = await VenueData.getVenue(venueId)
        if (cancelled) return
        if (venue) setFreshVenue(venue)
      } catch (error) {
        if (cancelled) return
        if (error instanceof AuthRequiredError || error instanceof RlsDeniedError) {
          toast.error('Sign-in required', { description: error.message })
        } else {
          console.warn('[pulse] VenuePage fresh fetch failed, using cached data', error)
          setVenueFetchFailed(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [venueId, refetchKey])

  if (!venues || !currentUser || !venueId) return null

  const cachedVenue = venues.find(v => v.id === venueId) ?? null
  const venue = freshVenue ?? cachedVenue
  if (!venue) {
    // Distinguish a genuine fetch failure (retryable) from a missing venue.
    if (venueFetchFailed) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4 px-6 text-center">
          <p className="font-semibold">Couldn’t load this venue</p>
          <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setRefetchKey((k) => k + 1)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Retry
            </button>
            <button onClick={() => navigate('/')} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">
              Go home
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Venue not found</p>
        <button onClick={() => navigate('/')} className="text-primary underline">Go home</button>
      </div>
    )
  }

  const cachedPulses = getPulsesWithUsers().filter(p => p.venueId === venue.id)
  const venuePulses: PulseWithUser[] = serverPulseList !== null
    ? serverPulseList.map((pulse) => ({
        ...pulse,
        user: resolvePulseUser(pulse.userId),
        venue,
      }))
    : cachedPulses
  const distance = userLocation
    ? Math.sqrt(Math.pow(venue.location.lat - userLocation.lat, 2) + Math.pow(venue.location.lng - userLocation.lng, 2)) * 69
    : undefined
  // Presence is derived from real signal: users who posted a recent pulse at
  // this venue are treated as "here". The engine still enforces a 5-minute
  // freshness window, so stale activity won't show.
  const allPulsesForPresence = pulses || []
  const presenceData = calculatePresence(venue.id, {
    currentUser,
    allUsers: ALL_USERS,
    allPulses: allPulsesForPresence,
    venueLocation: venue.location,
    userLocations: buildPresenceUserLocations(venue, allPulsesForPresence),
  })

  const handleCheckIn = async () => {
    if (USE_SUPABASE_BACKEND) {
      try {
        await CheckInData.createCheckIn({
          venueId: venue.id,
          lat: userLocation?.lat,
          lng: userLocation?.lng,
          source: userLocation ? 'geo' : 'manual',
        })
        toast.success('Checked in!', { description: venue.name })
      } catch (error) {
        if (error instanceof AuthRequiredError) {
          toast.error('Sign in to check in', { description: error.message })
          return
        }
        if (error instanceof RlsDeniedError) {
          toast.error('Check-in blocked', { description: error.message })
          return
        }
        console.warn('[pulse] createCheckIn failed', error)
        toast.error('Check-in failed', { description: 'Try again in a moment.' })
        return
      }
    }
    handleCreatePulse(venue.id)
  }

  return (
    <>
      <Suspense fallback={pageFallback}>
        <VenuePage
          venue={venue}
          venuePulses={venuePulses}
          venueHighlights={venueHighlights || []}
          highlightPulses={pulses || []}
          distance={distance}
          unitSystem={unitSystem}
          locationName={locationName}
          isTracking={isTracking}
          hasRealtimeLocation={!!realtimeLocation}
          isFavorite={isFavorite(venue.id)}
          isFollowed={isFollowed(venue.id)}
          currentUser={currentUser}
          onBack={() => navigate(-1)}
          onCreatePulse={handleCheckIn}
          onStartCrewCheckIn={() => handleStartCrewCheckIn(venue.id)}
          onReaction={handleReaction}
          onReportPulse={handlePulseReport}
          onToggleFavorite={() => handleToggleFavorite(venue.id)}
          onToggleFollow={() => handleToggleFollow(venue.id)}
          presenceData={presenceData}
          onOpenPresence={() => setPresenceSheetOpen(true)}
          onOpenIntegrations={integrationsEnabled ? () => {
            setIntegrationVenue(venue)
            navigate('/integrations')
          } : undefined}
          onLoadMoreVenuePulses={
            USE_SUPABASE_BACKEND ? () => { void venuePulseQuery.fetchNextPage() } : undefined
          }
          hasMoreVenuePulses={USE_SUPABASE_BACKEND ? Boolean(venuePulseQuery.hasNextPage) : false}
          isLoadingMoreVenuePulses={USE_SUPABASE_BACKEND ? venuePulseQuery.isFetchingNextPage : false}
        />
      </Suspense>
      <Suspense fallback={null}>
        <PresenceSheet
          open={presenceSheetOpen}
          onClose={() => setPresenceSheetOpen(false)}
          presence={presenceData}
          currentUser={currentUser}
          onUpdateSettings={(settings) => {
            void updateProfile({ presenceSettings: settings })
          }}
        />
      </Suspense>
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => navigateToTab(tab)}
        unreadNotifications={unreadNotificationCount}
      />
    </>
  )
}
