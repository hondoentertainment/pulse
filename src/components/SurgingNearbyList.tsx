import { memo, useMemo } from 'react'
import { ENERGY_CONFIG, Venue, Pulse } from '@/lib/types'
import { PulseActionRow } from '@/components/ux/PulseActionRow'
import { TimelineAvatar } from '@/components/ux/TimelineAvatar'
import { EmptySurgingStartHere } from '@/components/EmptySurgingStartHere'
import { venueHandle } from '@/lib/venue-handle'
import { getSurgingNearbyVenues, getVenueMapActivityFromLive, buildVenueActivityMap, formatSurgingRailSubline } from '@/lib/map-live-reviews'
import { getEnergyLabel } from '@/lib/pulse-engine'
import { snippetCaption } from '@/lib/live-reviews'
import { buildTrustGlance } from '@/lib/trust-glance'
import { TrustPinChips } from '@/components/TrustPinChips'
import { SignalPill } from '@/components/ux/SignalPill'
import { toneForEnergy } from '@/lib/signal-tone'
import { shareVenueFromSurface } from '@/lib/sharing'
import { toast } from 'sonner'

interface SurgingNearbyListProps {
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  onVenueClick: (venue: Venue) => void
  onBeFirstPulse?: (venue: Venue) => void
  onShareVenue?: (venue: Venue) => void
}

export const SurgingNearbyList = memo(function SurgingNearbyList({
  venues,
  pulses,
  userLocation,
  unitSystem: _unitSystem,
  onVenueClick,
  onBeFirstPulse,
  onShareVenue,
}: SurgingNearbyListProps) {
  const activityByVenueId = useMemo(
    () => buildVenueActivityMap(venues, pulses),
    [venues, pulses],
  )
  const nearby = useMemo(
    () => getSurgingNearbyVenues(venues, pulses, { userLocation, activityByVenue: activityByVenueId }),
    [venues, pulses, userLocation, activityByVenueId],
  )

  return (
    <section aria-labelledby="surging-nearby-heading">
      <h2 id="surging-nearby-heading" className="pb-2 text-[15px] font-semibold text-foreground">
        Surging nearby
      </h2>
      {nearby.length === 0 ? (
        <EmptySurgingStartHere
          venues={venues}
          onVenueClick={onVenueClick}
          onBeFirstPulse={onBeFirstPulse ?? onVenueClick}
        />
      ) : (
        <div>
          {nearby.map((venue) => {
            const activity = activityByVenueId.get(venue.id)
              ?? getVenueMapActivityFromLive(venue, undefined)
            const glance = buildTrustGlance(venue, pulses, Date.now(), activity)
            const open = () => onVenueClick(venue)
            const handleShare = () => {
              if (onShareVenue) {
                onShareVenue(venue)
                return
              }
              void shareVenueFromSurface(venue).then((result) => {
                if (result === 'copied') toast.success('Link copied')
              })
            }
            if (activity.latest) {
              const caption = snippetCaption(activity.latest.caption, 200)
                || formatSurgingRailSubline(activity)
              const liveLine = activity.liveReviewCount > 0
                ? `${activity.liveReviewCount} live · last hour`
                : activity.countLabel
              return (
                <article key={venue.id} className="mb-3 rounded-2xl border border-border bg-card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[16px] font-semibold text-foreground">{venue.name}</h3>
                      {liveLine && (
                        <p className="mt-1 text-[12px] text-muted-foreground">{liveLine}</p>
                      )}
                    </div>
                    <SignalPill tone={toneForEnergy(activity.latest.energyRating)}>
                      {ENERGY_CONFIG[activity.latest.energyRating].label}
                    </SignalPill>
                  </div>
                  <button
                    type="button"
                    onClick={open}
                    aria-label={caption}
                    className="mt-2 block w-full text-left text-[14px] text-foreground"
                  >
                    {caption}
                  </button>
                  {activity.latest.locationVerified === false && (
                    <p className="mt-1 text-[12px] text-muted-foreground">Unverified</p>
                  )}
                  <TrustPinChips chips={glance.chips} className="mt-1.5" />
                </article>
              )
            }
            return (
              <article key={venue.id} className="mb-3 flex gap-3 rounded-2xl border border-border bg-card p-3.5">
                <TimelineAvatar name={venue.name} />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    aria-label={`Open ${venue.name}${activity.countLabel ? `, ${activity.countLabel}` : ''}`}
                    onClick={open}
                    className="block w-full text-left"
                  >
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <h3 className="truncate text-[15px] font-bold text-foreground">{venue.name}</h3>
                      <span className="truncate text-[14px] text-muted-foreground">
                        {venueHandle(venue.name)}
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] text-foreground">
                      {activity.countLabel || getEnergyLabel(venue.pulseScore)}
                    </p>
                    <TrustPinChips chips={glance.chips} className="mt-1.5" />
                  </button>
                  <PulseActionRow onReply={open} onShare={handleShare} />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
})
