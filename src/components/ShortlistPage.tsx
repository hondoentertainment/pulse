import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, MapPin, ShareNetwork, ThumbsUp } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { PulseScore } from '@/components/PulseScore'
import { Button } from '@/components/ui/button'
import { useAppState } from '@/hooks/use-app-state'
import {
  applyShortlistVote,
  buildShortlistClipboardText,
  buildShortlistPath,
  buildShortlistShareText,
  buildShortlistShareUrl,
  leadingShortlistVenueId,
  parseShortlistVenueIds,
  parseShortlistVotes,
  resolveShortlistVenues,
  type ShortlistVotes,
} from '@/lib/shortlist'
import { formatDistance } from '@/lib/units'
import { getEnergyLabel } from '@/lib/pulse-engine'
import { resetDocumentMeta, setDocumentMeta, shortlistDocumentMeta } from '@/lib/document-meta'

function milesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function ShortlistPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { venues, userLocation, unitSystem } = useAppState()

  const venueIds = useMemo(() => parseShortlistVenueIds(params), [params])
  const { venues: shortlist, missingIds } = useMemo(
    () => resolveShortlistVenues(venueIds, venues || []),
    [venueIds, venues],
  )
  const votes = useMemo(
    () => parseShortlistVotes(params, venueIds),
    [params, venueIds],
  )
  const [myVotes, setMyVotes] = useState<Set<string>>(() => new Set())
  const leadingId = leadingShortlistVenueId(votes)
  const leadingVenue = leadingId
    ? shortlist.find((v) => v.id === leadingId)
    : undefined

  const toggleVote = (venueId: string) => {
    const hasVoted = myVotes.has(venueId)
    const nextVotes: ShortlistVotes = applyShortlistVote(
      votes,
      venueId,
      hasVoted ? -1 : 1,
    )
    setMyVotes((prev) => {
      const next = new Set(prev)
      if (hasVoted) next.delete(venueId)
      else next.add(venueId)
      return next
    })
    const path = buildShortlistPath(venueIds, nextVotes)
    const query = path.split('?')[1] ?? ''
    setParams(new URLSearchParams(query), { replace: true })
  }

  useEffect(() => {
    setDocumentMeta(shortlistDocumentMeta(shortlist.map((v) => v.name)))
    return () => resetDocumentMeta()
  }, [shortlist])

  const share = async () => {
    if (shortlist.length === 0) return
    const url = buildShortlistShareUrl(shortlist.map((v) => v.id), undefined, votes)
    const text = buildShortlistShareText(shortlist, votes)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: "Tonight's shortlist", text, url })
        return
      } catch {
        /* fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(buildShortlistClipboardText(shortlist, url))
    toast.success('Shortlist link copied')
  }

  return (
    <div className="mx-auto min-h-[60vh] max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight">Group shortlist</h1>
          <p className="text-sm text-muted-foreground">
            Tap “I’d go” to vote, then share the link back — votes travel with it.
          </p>
        </div>
        {shortlist.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => void share()}>
            <ShareNetwork size={16} />
            Share
          </Button>
        )}
      </div>

      {venueIds.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center">
          <p className="font-semibold">No venues in this shortlist</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Star spots you care about, then share a shortlist link with your group.
          </p>
          <Link
            to="/discover"
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Browse venues
          </Link>
        </div>
      )}

      {venueIds.length > 0 && shortlist.length === 0 && (
        <div className="rounded-2xl border border-border bg-card/70 px-4 py-8 text-center">
          <p className="font-semibold">Shortlist venues unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Those IDs are not in the current Seattle catalog.
          </p>
        </div>
      )}

      {leadingVenue && (
        <div
          className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm"
          data-testid="shortlist-leader"
        >
          <CheckCircle size={18} weight="fill" className="shrink-0 text-emerald-400" />
          <p>
            <span className="font-bold">{leadingVenue.name}</span> is winning —{' '}
            {votes[leadingVenue.id]} say go
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {shortlist.map((venue) => {
          const distance =
            userLocation != null
              ? milesBetween(
                  userLocation.lat,
                  userLocation.lng,
                  venue.location.lat,
                  venue.location.lng,
                )
              : undefined
          const voteCount = votes[venue.id] ?? 0
          const iVoted = myVotes.has(venue.id)
          return (
            <li key={venue.id}>
              <div className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 transition-colors hover:bg-card">
                <button
                  type="button"
                  onClick={() => navigate(`/venue/${encodeURIComponent(venue.id)}`)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  aria-label={`Open ${venue.name}`}
                >
                  <PulseScore score={venue.pulseScore} size="md" showLabel={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{venue.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getEnergyLabel(venue.pulseScore)}
                      {venue.category ? ` · ${venue.category}` : ''}
                      {distance !== undefined
                        ? ` · ${formatDistance(distance, unitSystem ?? 'imperial')}`
                        : ''}
                      {voteCount > 0
                        ? ` · ${voteCount} say go`
                        : ''}
                    </p>
                  </div>
                  <MapPin size={16} className="shrink-0 text-muted-foreground" />
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant={iVoted ? 'default' : 'outline'}
                  className="min-h-11 shrink-0 gap-1 touch-manipulation"
                  aria-pressed={iVoted}
                  aria-label={iVoted ? `Remove your vote for ${venue.name}` : `Vote to go to ${venue.name}`}
                  data-testid="shortlist-vote"
                  onClick={() => toggleVote(venue.id)}
                >
                  <ThumbsUp size={14} weight={iVoted ? 'fill' : 'regular'} />
                  {iVoted ? 'Going' : "I'd go"}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {missingIds.length > 0 && shortlist.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {missingIds.length} venue{missingIds.length === 1 ? '' : 's'} from this link
          could not be loaded.
        </p>
      )}
    </div>
  )
}
