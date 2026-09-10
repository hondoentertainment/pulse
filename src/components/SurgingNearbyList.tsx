import { memo, useMemo } from 'react'
import { Venue, Pulse } from '@/lib/types'
import { EnergyBadge } from '@/components/EnergyBadge'
import { TrustGlanceRow } from '@/components/TrustGlanceRow'
import { getSurgingNearbyVenues, getVenueMapActivityFromLive, buildVenueActivityMap, formatSurgingRailSubline } from '@/lib/map-live-reviews'

interface SurgingNearbyListProps {
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  onVenueClick: (venue: Venue) => void
}

export const SurgingNearbyList = memo(function SurgingNearbyList({
  venues,
  pulses,
  userLocation,
  unitSystem: _unitSystem,
  onVenueClick,
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
    <section aria-labelledby="surging-nearby-heading" className="space-y-3.5">
      <h2 id="surging-nearby-heading" className="text-base font-bold">
        Surging nearby
      </h2>
      {nearby.length === 0 ? (
        <p className="rounded-[18px] bg-[#17171C] p-3.5 text-sm text-muted-foreground">
          Quiet nearby — no live reviews in the last hour.
        </p>
      ) : (
        <div className="space-y-3">
          {nearby.map((venue) => {
            const activity = activityByVenueId.get(venue.id)
              ?? getVenueMapActivityFromLive(venue, undefined)
            const energy = activity.latest?.energyRating
            return (
              <button
                key={venue.id}
                type="button"
                aria-label={`Open ${venue.name}${activity.countLabel ? `, ${activity.countLabel}` : ''}`}
                onClick={() => onVenueClick(venue)}
                className="flex w-full flex-col gap-2 rounded-[18px] bg-[#17171C] p-3.5 text-left transition-colors hover:bg-[#1C1C21]"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="truncate text-[15px] font-semibold text-foreground">{venue.name}</h3>
                  <EnergyBadge
                    rating={energy}
                    score={energy ? undefined : venue.pulseScore}
                    className="shrink-0"
                  />
                </div>
                <TrustGlanceRow venue={venue} pulses={pulses} activity={activity} />
                <p className="text-xs text-muted-foreground">
                  {activity.countLabel || formatSurgingRailSubline(activity)}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
})
