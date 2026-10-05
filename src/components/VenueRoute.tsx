import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAppState } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { CrewTonightData, USE_SUPABASE_BACKEND, VenueData, PresenceData } from '@/lib/data'
import { useVenuePulsesInfinite } from '@/hooks/api/use-pulses'
import { AuthRequiredError } from '@/lib/auth/require-auth'
import { RlsDeniedError } from '@/lib/auth/rls-helpers'
import type { Pulse, PulseWithUser, Venue } from '@/lib/types'
import { toast } from 'sonner'
import { AUTH_PATH, getWriteAuthRedirect, WRITE_AUTH_COPY } from '@/lib/guest-discovery'
import { parseComposeVenueId, venueComposePath } from '@/lib/auth-return-intent'
import { isInviteArrival } from '@/lib/invite-friend'
import { emptyHereNow, type HereNowSummary } from '@/lib/here-now'
import { DoorPinData, FollowData, PulseAgreeData, PulseReplyData, VenueClaimData } from '@/lib/data'
import type { PulseReply } from '@/lib/pulse-thread'
import type { PulseAgree } from '@/lib/pulse-same'
import type { VenueDoorPin } from '@/lib/door-pin'
import type { VenueClaim } from '@/lib/venue-owner'
import { confirmImHere } from '@/lib/im-here-confirm'
import { rememberOpenedVenue } from '@/lib/recent-venues'
import { coastCityKeyForVenueId, findWritableVenue, loadCityCuratedCatalog } from '@/lib/city-catalog'
import { launchVenueMatchesShareId } from '@/lib/coast-venue-ids'
import { resolveShareVenueReady } from '@/lib/share-landing'
import { MapHomeSkeleton } from '@/components/MapHomeSkeleton'
import { filterModeratedPulses } from '@/lib/content-moderation'
import type { CrewPresenceRow } from '@/lib/crew-im-here'

const VenuePage = lazy(() => import('@/components/VenuePage').then(m => ({ default: m.VenuePage })))

const pageFallback = <MapHomeSkeleton />

export function VenueRoute() {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = useAppState()
  const handlers = useAppHandlers()
  const { session, isPlaceholder } = useSupabaseAuth()

  const {
    venues,
    pinWritableVenue,
    currentUser,
    contentReports,
    moderatedPulses: _moderatedPulses,
    unitSystem,
    locationName,
    isTracking,
    realtimeLocation,
    userLocation,
    isFavorite,
    isFollowed,
    integrationsEnabled,
    resolvePulseUser,
    getPulsesWithUsers,
    presenceSheetOpen: _presenceSheetOpen,
    setPresenceSheetOpen,
    setIntegrationVenue,
    setSubPage: _setSubPage,
  } = state

  const {
    handleCreatePulse,
    handleReaction,
    handlePulseReport,
    handleHidePulse,
    handlePinMyNight,
    handleToggleFavorite,
    handleToggleFollow,
    handleToggleFriendFollow,
    handleStartCrewCheckIn,
    handlePulseReply,
    handleSameAgree,
    handleBlockUser,
    handleCrewTonight,
    handleDoorPin,
    handleOwnerReplyNotices,
  } = handlers

  // Live venue row + paginated pulses when Supabase backend is on.
  const [freshVenue, setFreshVenue] = useState<Venue | null>(null)
  const [serverLookupSettled, setServerLookupSettled] = useState(false)
  const [seedVenue, setSeedVenue] = useState<Venue | null>(null)
  const [seedLookupSettled, setSeedLookupSettled] = useState(false)
  const [hereNow, setHereNow] = useState<HereNowSummary>(emptyHereNow)
  const [crewHere, setCrewHere] = useState<CrewPresenceRow[]>([])
  const [replies, setReplies] = useState<PulseReply[]>([])
  const [agrees, setAgrees] = useState<PulseAgree[]>([])
  const [doorPin, setDoorPin] = useState<VenueDoorPin | null>(null)
  const [claims, setClaims] = useState<VenueClaim[]>([])
  const [myNightPinned, setMyNightPinned] = useState(false)

  const [durableVenueId, setDurableVenueId] = useState<string | null>(null)
  const pulseLookupId = durableVenueId ?? venueId
  const venuePulseQuery = useVenuePulsesInfinite(
    USE_SUPABASE_BACKEND ? pulseLookupId : undefined,
    30,
  )

  const serverPulseList: Pulse[] | null = useMemo(() => {
    if (!USE_SUPABASE_BACKEND || !venuePulseQuery.isSuccess) return null
    return venuePulseQuery.data?.pages.flatMap(p => p.items) ?? []
  }, [USE_SUPABASE_BACKEND, venuePulseQuery.data?.pages, venuePulseQuery.isSuccess])

  useEffect(() => {
    if (!USE_SUPABASE_BACKEND || !venueId) {
      setServerLookupSettled(true)
      return
    }
    let cancelled = false
    setServerLookupSettled(false)

    ;(async () => {
      try {
        const key = coastCityKeyForVenueId(venueId)
        let lookupId = venueId
        if (key === 'portland' || key === 'san-francisco') {
          const rows = await loadCityCuratedCatalog(key)
          const match = rows.find((row) => launchVenueMatchesShareId(row, venueId))
          if (match) lookupId = match.id
        }
        if (!cancelled) setDurableVenueId(lookupId)
        const venue = await VenueData.getVenue(lookupId)
        if (cancelled) return
        if (venue) setFreshVenue(venue)
      } catch (error) {
        if (cancelled) return
        if (error instanceof AuthRequiredError || error instanceof RlsDeniedError) {
          toast.error('Sign-in required', { description: error.message })
        } else {
          console.warn('[pulse] VenuePage fresh fetch failed, using cached data', error)
        }
      } finally {
        if (!cancelled) setServerLookupSettled(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [venueId])

  useEffect(() => {
    if (!venueId) {
      setSeedLookupSettled(true)
      return
    }
    const key = coastCityKeyForVenueId(venueId)
    const already = findWritableVenue(venues ?? [], venueId)
    if (!key || already) {
      if (already) setDurableVenueId(already.id)
      setSeedVenue(null)
      setSeedLookupSettled(true)
      return
    }
    let cancelled = false
    setSeedLookupSettled(false)
    void loadCityCuratedCatalog(key).then((rows) => {
      if (cancelled) return
      const match = rows.find((venue) => launchVenueMatchesShareId(venue, venueId)) ?? null
      setSeedVenue(match)
      if (match) {
        setDurableVenueId(match.id)
        pinWritableVenue(match)
      }
      setSeedLookupSettled(true)
    }).catch(() => {
      if (!cancelled) setSeedLookupSettled(true)
    })
    return () => {
      cancelled = true
    }
  }, [pinWritableVenue, venueId, venues])

  useEffect(() => {
    if (!pulseLookupId || !session?.user?.id) {
      setCrewHere([])
      return
    }
    let cancelled = false
    void CrewTonightData.listCrewImHere(pulseLookupId).then((rows) => {
      if (!cancelled) setCrewHere(rows)
    }).catch(() => {
      if (!cancelled) setCrewHere([])
    })
    return () => {
      cancelled = true
    }
  }, [pulseLookupId, session?.user?.id])

  useEffect(() => {
    if (!pulseLookupId) return
    let cancelled = false
    void PulseReplyData.listRepliesForVenue(pulseLookupId).then((rows) => {
      if (!cancelled) setReplies(rows)
    }).catch(() => undefined)
    void import('@/lib/data/pulses').then(({ listRecentPulsesAtVenue }) => (
      listRecentPulsesAtVenue(pulseLookupId, 40).then((rows) => (
        PulseAgreeData.listAgreesForPulses(rows.map((pulse) => pulse.id))
      )).then((rows) => {
        if (!cancelled) setAgrees(rows)
      })
    )).catch(() => undefined)
    void DoorPinData.fetchVenueDoorPin(pulseLookupId).then((pin) => {
      if (!cancelled) setDoorPin(pin)
    }).catch(() => undefined)
    if (session?.user?.id) {
      void VenueClaimData.listMyVenueClaims(session.user.id).then((rows) => {
        if (!cancelled) setClaims(rows)
      }).catch(() => undefined)
      void FollowData.listPinnedVenues(session.user.id).then((ids) => {
        if (!cancelled) setMyNightPinned(ids.includes(pulseLookupId))
      }).catch(() => undefined)
    }
    void PresenceData.fetchHereNowSummary(pulseLookupId, Boolean(session))
      .then((summary) => {
        if (!cancelled) setHereNow(summary)
      })
      .catch(() => {
        if (!cancelled) setHereNow(emptyHereNow())
      })
    return () => {
      cancelled = true
    }
  }, [pulseLookupId, session])

  const openedComposeFor = useRef<string | null>(null)
  useEffect(() => {
    if (!venueId) return
    if (parseComposeVenueId(location.pathname, location.search) !== venueId) return
    if (!session && !isPlaceholder) return
    const resolved = findWritableVenue(venues ?? [], venueId) ?? seedVenue
    if (!resolved || !launchVenueMatchesShareId(resolved, venueId)) return
    if (!findWritableVenue(venues ?? [], resolved.id)) {
      pinWritableVenue(resolved)
      return
    }
    if (openedComposeFor.current === venueId) return
    openedComposeFor.current = venueId
    handleCreatePulse(resolved.id)
  }, [
    handleCreatePulse,
    isPlaceholder,
    location.pathname,
    location.search,
    pinWritableVenue,
    seedVenue,
    session,
    venueId,
    venues,
  ])

  useEffect(() => {
    if (venueId) rememberOpenedVenue(venueId)
  }, [venueId])

  if (!currentUser || !venueId) return <MapHomeSkeleton />

  const catalog = venues ?? []
  const cachedVenue = findWritableVenue(catalog, venueId) ?? null
  const venue = freshVenue ?? cachedVenue ?? seedVenue
  const phase = resolveShareVenueReady({
    cached: Boolean(cachedVenue || seedVenue),
    fresh: Boolean(freshVenue),
    catalogReady: Array.isArray(venues),
    lookupSettled: (serverLookupSettled || !USE_SUPABASE_BACKEND) && seedLookupSettled,
  })
  if (!venue && phase === 'pending') {
    return (
      <div className="min-h-screen bg-background" aria-busy="true" aria-label="Opening venue energy">
        <div className="mx-auto max-w-2xl space-y-3 px-4 pb-6 pt-6">
          <p className="text-[13px] font-semibold text-accent">Someone shared a venue</p>
          <h1 className="text-[26px] font-bold text-foreground">Opening live energy</h1>
          <p className="text-[13px] text-muted-foreground">
            Loading this room. Guests can view it. Posting still goes to sign-in.
          </p>
          <div className="h-28 animate-pulse rounded-2xl bg-card" />
        </div>
      </div>
    )
  }
  if (!venue) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Venue not found</p>
        <button onClick={() => navigate('/')} className="text-primary underline">Go home</button>
      </div>
    )
  }

  const cachedPulses = getPulsesWithUsers().filter(p => p.venueId === venue.id)
  const rawVenuePulses: PulseWithUser[] = serverPulseList !== null
    ? serverPulseList.map((pulse) => ({
        ...pulse,
        user: resolvePulseUser(pulse.userId),
        venue,
      }))
    : cachedPulses
  const venuePulses = filterModeratedPulses(
    rawVenuePulses,
    currentUser?.id ?? '',
    [],
    [],
    contentReports ?? [],
  ) as PulseWithUser[]
  const distance = userLocation
    ? Math.sqrt(Math.pow(venue.location.lat - userLocation.lat, 2) + Math.pow(venue.location.lng - userLocation.lng, 2)) * 69
    : undefined

  const handleCheckIn = async () => {
    const authRedirect = getWriteAuthRedirect({
      isPlaceholder,
      hasSession: Boolean(session),
      next: venueComposePath(venue.id),
    })
    if (authRedirect) {
      toast.error(WRITE_AUTH_COPY.checkIn.title, { description: WRITE_AUTH_COPY.checkIn.description })
      navigate(authRedirect)
      return
    }

    if (USE_SUPABASE_BACKEND) {
      try {
        await confirmImHere({
          venueId: venue.id,
          venueName: venue.name,
          signedIn: true,
          lat: userLocation?.lat,
          lng: userLocation?.lng,
        })
        const summary = await PresenceData.fetchHereNowSummary(venue.id, true).catch(() => emptyHereNow())
        setHereNow(summary)
        toast.success('I’m here · 90 min', { description: venue.name })
      } catch (error) {
        if (error instanceof AuthRequiredError) {
          toast.error(WRITE_AUTH_COPY.checkIn.title, { description: WRITE_AUTH_COPY.checkIn.description })
          navigate(getWriteAuthRedirect({
            isPlaceholder,
            hasSession: false,
            next: venueComposePath(venue.id),
          }) ?? AUTH_PATH)
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
          onPinMyNight={() => handlePinMyNight(venue.id)}
          onHidePulse={handleHidePulse}
          onFollowUser={handleToggleFriendFollow}
          onPulseReply={handlePulseReply}
          onSameAgree={handleSameAgree}
          onBlockUser={handleBlockUser}
          onCrewTonight={handleCrewTonight}
          crewHere={crewHere}
          onOwnerReplyNotices={handleOwnerReplyNotices}
          onDoorPin={async (vid, pid) => {
            await handleDoorPin(vid, pid)
            const pin = await DoorPinData.fetchVenueDoorPin(vid).catch(() => null)
            setDoorPin(pin)
          }}
          catalogVenues={venues}
          claims={claims}
          doorPin={doorPin}
          replies={replies}
          agrees={agrees}
          myNightPinned={myNightPinned}
          invitePrimed={isInviteArrival(location.search)}
          hereNow={hereNow}
          presenceData={{
            venueId: venue.id,
            friendsHereNowCount: hereNow.count,
            friendsNearbyCount: hereNow.friends.length,
            familiarFacesCount: 0,
            prioritizedAvatars: [],
            lastPresenceUpdateAt: new Date().toISOString(),
            isSuppressed: false,
          }}
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
    </>
  )
}
