import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useKV } from '@github/spark/hooks'
import { useAppState } from '@/hooks/use-app-state'
import { VenueInboxPage } from '@/components/VenueInboxPage'
import { listMyVenueStaffRoles, type VenueStaffMembership } from '@/lib/data/venue-staff'
import { listMyVenueClaims, submitVenueClaim, tryVerifyVenueClaimByEmailDomain } from '@/lib/data/venue-claims'
import { CLAIM_DOMAIN_COPY, workEmailMatchesVenue } from '@/lib/claim-email-domain'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { AUTH_PATH, getWriteAuthRedirect, WRITE_AUTH_COPY } from '@/lib/guest-discovery'
import {
  dismissReportsForPulse,
  mapPulseReportsToContentReports,
  mergeInboxReports,
} from '@/lib/owner-inbox'
import { dismissReportsForPulseOnServer, listVenueReportsOnServer } from '@/lib/ops-client'
import type { ContentReport } from '@/lib/content-moderation'
import { createVenueClaim, type VenueClaim } from '@/lib/venue-owner'
import { USE_SUPABASE_BACKEND, VenueData } from '@/lib/data'
import type { Venue } from '@/lib/types'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { toast } from 'sonner'

export function VenueInboxRoute() {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()
  const { venues, currentUser, moderatedPulses, contentReports, setContentReports } = useAppState()
  const { session, isPlaceholder, signInWithOtp, user } = useSupabaseAuth()
  const [localClaims, setLocalClaims] = useKV<VenueClaim[]>('venue-claims', [])
  const [serverClaims, setServerClaims] = useState<VenueClaim[]>([])
  const [staffRoles, setStaffRoles] = useState<VenueStaffMembership[]>([])
  const [freshVenue, setFreshVenue] = useState<Venue | null>(null)
  const [claimBusy, setClaimBusy] = useState(false)
  const [serverReports, setServerReports] = useState<ContentReport[]>([])

  const cached = venues?.find((venue) => venue.id === venueId) ?? null
  const venue = freshVenue ?? cached
  const claims = USE_SUPABASE_BACKEND ? serverClaims : (localClaims ?? [])

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
    const authRedirect = getWriteAuthRedirect({
      isPlaceholder,
      hasSession: Boolean(session),
    })
    if (authRedirect) {
      navigate(authRedirect)
    }
  }, [isPlaceholder, navigate, session])

  useEffect(() => {
    if (!currentUser?.id || !isFeatureEnabled('venueInbox')) return
    let cancelled = false
    const loadClaims = () => {
      void listMyVenueStaffRoles(currentUser.id).then((roles) => {
        if (!cancelled) setStaffRoles(roles)
      })
      if (USE_SUPABASE_BACKEND) {
        void listMyVenueClaims(currentUser.id).then(async (rows) => {
          const sessionEmail = user?.email?.trim().toLowerCase()
          const next = await Promise.all(rows.map(async (claim) => {
            if (
              claim.status === 'pending'
              && sessionEmail
              && claim.businessEmail
              && sessionEmail === claim.businessEmail.toLowerCase()
            ) {
              const verified = await tryVerifyVenueClaimByEmailDomain(claim.id)
              return verified ?? claim
            }
            return claim
          }))
          if (!cancelled) setServerClaims(next)
        })
      }
    }
    loadClaims()
    const onFocus = () => {
      if (!cancelled) loadClaims()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [currentUser?.id, user?.email])

  useEffect(() => {
    if (!venueId || !currentUser?.id || !isFeatureEnabled('venueInbox')) return
    let cancelled = false
    void listVenueReportsOnServer(venueId).then((rows) => {
      if (!cancelled) setServerReports(mapPulseReportsToContentReports(rows))
    })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, venueId])

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

  const handleSubmitClaim = async (input: { evidence: string; notes?: string; workEmail?: string }) => {
    const authRedirect = getWriteAuthRedirect({
      isPlaceholder,
      hasSession: Boolean(session),
    })
    if (authRedirect || !currentUser) {
      toast.error(WRITE_AUTH_COPY.claim.title, { description: WRITE_AUTH_COPY.claim.description })
      navigate(authRedirect ?? AUTH_PATH)
      return
    }
    setClaimBusy(true)
    try {
      if (USE_SUPABASE_BACKEND) {
        const claim = await submitVenueClaim({
          venueId: venue.id,
          evidence: input.evidence,
          notes: input.notes,
          workEmail: input.workEmail,
          venue,
        })
        setServerClaims((current) => [
          claim,
          ...current.filter((row) => !(row.venueId === claim.venueId && row.claimantUserId === claim.claimantUserId)),
        ])
        const sessionEmail = user?.email?.trim().toLowerCase()
        const workEmail = input.workEmail?.trim().toLowerCase()
        if (workEmail && sessionEmail !== workEmail) {
          await signInWithOtp(workEmail)
          toast.success('Confirm your work email', {
            description: CLAIM_DOMAIN_COPY.verifyAfterConfirm,
          })
        } else if (claim.status === 'verified') {
          toast.success(CLAIM_DOMAIN_COPY.verified)
        } else if (workEmail && !workEmailMatchesVenue(workEmail, venue)) {
          toast.success('Claim submitted', {
            description: CLAIM_DOMAIN_COPY.pendingNoMatch,
          })
        } else {
          toast.success('Claim submitted', {
            description: 'Inbox stays locked until a verified claim or staff role is on file.',
          })
        }
      } else {
        const claim = createVenueClaim(
          venue.id,
          currentUser.id,
          input.notes || venue.name,
          input.workEmail || '',
          'email',
          input.evidence,
        )
        setLocalClaims((current) => [claim, ...(current ?? [])])
        toast.success('Claim submitted', {
          description: 'Inbox stays locked until a verified claim or staff role is on file.',
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit claim')
    } finally {
      setClaimBusy(false)
    }
  }

  return (
    <VenueInboxPage
      venue={venue}
      pulses={moderatedPulses}
      currentUser={currentUser ?? null}
      claims={claims}
      staffRoles={staffRoles}
      onBack={() => navigate(`/venue/${venue.id}`)}
      onSubmitClaim={handleSubmitClaim}
      claimBusy={claimBusy}
      reports={mergeInboxReports(serverReports, contentReports ?? [])}
      onDismissReports={(pulseId) => {
        setServerReports((current) => dismissReportsForPulse(current, pulseId))
        setContentReports((current) => dismissReportsForPulse(current ?? [], pulseId))
        void dismissReportsForPulseOnServer(pulseId).then((ok) => {
          if (!ok) {
            toast.error('Could not dismiss on the server', {
              description: 'Local dismiss still applied. Apply owner report RLS or retry.',
            })
          }
        })
      }}
    />
  )
}
