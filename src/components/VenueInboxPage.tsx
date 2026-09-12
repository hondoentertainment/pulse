import { useMemo, useState } from 'react'
import type { Pulse, User, Venue } from '@/lib/types'
import type { VenueClaim } from '@/lib/venue-owner'
import type { ContentReport } from '@/lib/content-moderation'
import {
  canAccessVenueInbox,
} from '@/lib/live-reviews'
import { ENERGY_CONFIG } from '@/lib/types'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { CaretLeft } from '@phosphor-icons/react'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { track } from '@/lib/observability/analytics'
import { Button } from '@/components/ui/button'
import { UX_CARD, UX_CTA } from '@/lib/ux-chrome'
import {
  createOwnerReply,
  isPulseDismissed,
  loadOwnerDismissals,
  loadOwnerReplies,
  persistOwnerDismissal,
  persistOwnerReply,
  reportsForPulse,
  summarizeOwnerInbox,
  type OwnerInboxDismissal,
  type OwnerInboxReply,
} from '@/lib/owner-inbox'

interface VenueInboxPageProps {
  venue: Venue
  pulses: Pulse[]
  currentUser: User | null
  claims?: VenueClaim[]
  staffRoles?: Array<{ venueId: string; userId: string }>
  onBack: () => void
  onSubmitClaim?: (input: { evidence: string; notes?: string; workEmail?: string }) => Promise<void> | void
  claimBusy?: boolean
  reports?: ContentReport[]
  onDismissReports?: (pulseId: string) => void
}

export function VenueInboxPage({
  venue,
  pulses,
  currentUser,
  claims = [],
  staffRoles = [],
  onBack,
  onSubmitClaim,
  claimBusy = false,
  reports = [],
  onDismissReports,
}: VenueInboxPageProps) {
  const allowed = canAccessVenueInbox({
    userId: currentUser?.id,
    venueId: venue.id,
    claims,
    staffRoles,
  })
  const summary = useMemo(
    () => summarizeOwnerInbox({ pulses, venueId: venue.id, reports }),
    [pulses, venue.id, reports],
  )
  const tonight = summary.tonight
  const visibleTonight = allowed ? tonight : []
  const myClaim = claims.find(
    (claim) => claim.venueId === venue.id && claim.claimantUserId === currentUser?.id,
  )
  const [evidence, setEvidence] = useState('')
  const [notes, setNotes] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replies, setReplies] = useState<OwnerInboxReply[]>(() => loadOwnerReplies())
  const [dismissals, setDismissals] = useState<OwnerInboxDismissal[]>(() => loadOwnerDismissals())

  if (!isFeatureEnabled('venueInbox')) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <button type="button" onClick={onBack} className="mb-4 rounded-lg p-2 hover:bg-muted">
          <CaretLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Venue inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Venue inbox is turned off by the venueInbox feature flag.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto max-w-2xl space-y-3.5 px-5 pb-6 pt-8">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <CaretLeft size={18} />
            Venue
          </button>
          <h1 className="text-[22px] font-bold text-foreground">Tonight’s queue</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {venue.name} · {allowed ? 'verified claim' : 'owner inbox'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className={`${UX_CARD} p-3.5`}>
            <p className="text-[22px] font-bold leading-none text-foreground">{allowed ? summary.reviewCount : 0}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Reviews</p>
          </div>
          <div className={`${UX_CARD} p-3.5`}>
            <p className="text-[22px] font-bold leading-none text-amber-300">{allowed ? summary.reportCount : 0}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Reports</p>
          </div>
        </div>

        {!allowed ? (
          <div className={`${UX_CARD} space-y-3 p-3.5`}>
            <h2 className="text-base font-semibold">Claim needed</h2>
            <p className="text-sm text-muted-foreground">
              Tonight’s reviews stay hidden until a verified venue claim or a
              venue_staff row unlocks this inbox. Pending claims do not grant access.
              A work email on the venue’s public website domain can verify after
              magic-link / OTP — we never invent an admin.
            </p>
            {myClaim?.status === 'pending' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Your claim is pending review. We will not invent an approval.
                  A matching work-email domain can still verify it after magic-link / OTP.
                </p>
                {currentUser && onSubmitClaim && (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void onSubmitClaim({
                        evidence: evidence.trim() || myClaim.evidence || 'Work email confirmation',
                        notes,
                        workEmail,
                      })
                    }}
                  >
                    <label className="block text-xs text-muted-foreground" htmlFor="claim-work-email-pending">
                      Work email
                    </label>
                    <input
                      id="claim-work-email-pending"
                      type="email"
                      value={workEmail}
                      onChange={(event) => setWorkEmail(event.target.value)}
                      placeholder="you@venue-domain.com"
                      required
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                    <Button type="submit" className={UX_CTA} disabled={claimBusy || !workEmail.trim()}>
                      {claimBusy ? 'Submitting…' : 'Confirm work email'}
                    </Button>
                  </form>
                )}
              </div>
            ) : myClaim?.status === 'rejected' ? (
              <p className="text-xs text-muted-foreground">
                Previous claim was rejected{myClaim.rejectedReason ? `: ${myClaim.rejectedReason}` : '.'}
              </p>
            ) : null}
            {currentUser && onSubmitClaim && myClaim?.status !== 'pending' && (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void onSubmitClaim({ evidence, notes, workEmail })
                }}
              >
                <label className="block text-xs text-muted-foreground" htmlFor="claim-evidence">
                  How are you connected to this venue?
                </label>
                <textarea
                  id="claim-evidence"
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  minLength={8}
                  required
                  placeholder="I manage the door / I own the lease / staff email…"
                  className="w-full min-h-20 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Business name (optional)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <label className="block text-xs text-muted-foreground" htmlFor="claim-work-email">
                  Work email
                </label>
                <input
                  id="claim-work-email"
                  type="email"
                  value={workEmail}
                  onChange={(event) => setWorkEmail(event.target.value)}
                  placeholder="you@venue-domain.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Confirm the magic link / OTP for that address. Domain match verifies
                  without an admin; a mismatch stays pending.
                </p>
                <Button type="submit" className={UX_CTA} disabled={claimBusy || evidence.trim().length < 8}>
                  {claimBusy ? 'Submitting…' : 'Submit claim'}
                </Button>
              </form>
            )}
            {!currentUser && (
              <p className="text-xs text-muted-foreground">Sign in to submit a venue claim.</p>
            )}
          </div>
        ) : tonight.length === 0 ? (
          <div className={`${UX_CARD} p-3.5`}>
            <h2 className="text-base font-semibold">No live reviews tonight</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When patrons post energy + caption reviews after 4pm, they will
              appear here. Nothing is fabricated.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleTonight.filter((pulse) => !isPulseDismissed(dismissals, pulse.id, venue.id)).map((pulse, index) => {
              const pulseReports = reportsForPulse(reports, pulse.id)
              const existingReplies = replies.filter((reply) => reply.pulseId === pulse.id)
              return (
                <li
                  key={pulse.id}
                  className={`${UX_CARD} space-y-2 p-3.5`}
                  onClick={() => {
                    track('pulse_viewed', {
                      pulseId: pulse.id,
                      venueId: venue.id,
                      position: index,
                      feed: 'inbox',
                    })
                  }}
                >
                  <p className="text-[13px] font-semibold text-foreground">
                    {ENERGY_CONFIG[pulse.energyRating].label} · {formatTimeAgo(pulse.createdAt).replace(' ago', '')}
                  </p>
                  {pulse.caption && (
                    <p className="text-sm text-foreground">{pulse.caption}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation()
                        setReplyingId(pulse.id)
                        setReplyBody('')
                      }}
                    >
                      Reply
                    </button>
                    {pulseReports.length > 0 && (
                      <button
                        type="button"
                        className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDismissReports?.(pulse.id)
                          setDismissals(persistOwnerDismissal({
                            pulseId: pulse.id,
                            venueId: venue.id,
                            dismissedAt: new Date().toISOString(),
                          }))
                        }}
                      >
                        Dismiss report
                      </button>
                    )}
                  </div>
                  {existingReplies.map((reply) => (
                    <p key={reply.id} className="text-xs text-muted-foreground">
                      Reply: {reply.body}
                    </p>
                  ))}
                  {replyingId === pulse.id && (
                    <form
                      className="space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const reply = createOwnerReply({
                          pulseId: pulse.id,
                          venueId: venue.id,
                          body: replyBody,
                        })
                        if (!reply) return
                        setReplies(persistOwnerReply(reply))
                        setReplyingId(null)
                        setReplyBody('')
                      }}
                    >
                      <label className="sr-only" htmlFor={`reply-${pulse.id}`}>Reply</label>
                      <textarea
                        id={`reply-${pulse.id}`}
                        value={replyBody}
                        onChange={(event) => setReplyBody(event.target.value)}
                        className="w-full min-h-16 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Reply to this review"
                      />
                      <Button type="submit" disabled={replyBody.trim().length === 0}>
                        Send reply
                      </Button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
