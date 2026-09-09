import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useKV } from '@github/spark/hooks'
import { useAppState } from '@/hooks/use-app-state'
import { VenueInboxPage } from '@/components/VenueInboxPage'
import { listMyVenueStaffRoles, type VenueStaffMembership } from '@/lib/data/venue-staff'
import type { VenueClaim } from '@/lib/venue-owner'
import { USE_SUPABASE_BACKEND, VenueData } from '@/lib/data'
import type { Venue } from '@/lib/types'
import { isFeatureEnabled } from '@/lib/feature-flags'

export function VenueInboxRoute() {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()
  const { venues, currentUser, moderatedPulses } = useAppState()
  const [claims] = useKV<VenueClaim[]>('venue-claims', [])
  const [staffRoles, setStaffRoles] = useState<VenueStaffMembership[]>([])
  const [freshVenue, setFreshVenue] = useState<Venue | null>(null)

  const cached = venues?.find((venue) => venue.id === venueId) ?? null
  const venue = freshVenue ?? cached

  useEffect(() => {
    if (!USE_SUPABASE_BACKEND || !venueId) return
    let cancelled = false
    void VenueData.getVenue(venueId).then((row) => {
      if (!cancelled && row) setFreshVenue(row)
    }).catch(() => {
      /* keep cached */
    })
    return () => {
      cancelled = true
    }
  }, [venueId])

  useEffect(() => {
    if (!currentUser?.id || !isFeatureEnabled('venueInbox')) return
    let cancelled = false
    void listMyVenueStaffRoles(currentUser.id).then((roles) => {
      if (!cancelled) setStaffRoles(roles)
    })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  if (!venueId || !venue) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-muted-foreground">Venue not found</p>
        <button type="button" className="text-primary underline" onClick={() => navigate('/')}>
          Go home
        </button>
      </div>
    )
  }

  return (
    <VenueInboxPage
      venue={venue}
      pulses={moderatedPulses}
      currentUser={currentUser ?? null}
      claims={claims ?? []}
      staffRoles={staffRoles}
      onBack={() => navigate(`/venue/${venue.id}`)}
    />
  )
}
