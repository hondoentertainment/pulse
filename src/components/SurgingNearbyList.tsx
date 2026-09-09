import { Venue, Pulse } from '@/lib/types'
import { EnergyBadge } from '@/components/EnergyBadge'
import { getSurgingNearbyVenues, getVenueMapActivity } from '@/lib/map-live-reviews'

interface SurgingNearbyListProps {
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  onVenueClick: (venue: Venue) => void
}

export function SurgingNearbyList({
  venues,
  pulses,
  userLocation,
  unitSystem: _unitSystem,
  onVenueClick,
}: SurgingNearbyListProps) {
  const nearby = getSurgingNearbyVenues(venues, pulses, { userLocation })

  return (
    <section aria-labelledby="surging-nearby-heading" className="space-y-3">
      <h2 id="surging-nearby-heading" className="text-xl font-bold">
        Surging nearby
      </h2>
      {nearby.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-card/60 px-4 py-3.5 text-sm text-muted-foreground">
          Quiet nearby — no live reviews in the last hour.
        </p>
      ) : (
        <div className="space-y-3">
          {nearby.map((venue) => {
            const activity = getVenueMapActivity(venue, pulses)
            const energy = activity.latest?.energyRating
            return (
              <button
                key={venue.id}
                type="button"
                aria-label={`Open ${venue.name}${activity.countLabel ? `, ${activity.countLabel}` : ''}`}
                onClick={() => onVenueClick(venue)}
                className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-white/10 bg-card/80 px-4 py-3.5 text-left transition-colors hover:border-white/20"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-foreground">{venue.name}</h3>
                  {activity.countLabel && (
                    <p className="mt-1 text-sm text-muted-foreground">{activity.countLabel}</p>
                  )}
                </div>
                <EnergyBadge
                  rating={energy}
                  score={energy ? undefined : venue.pulseScore}
                  className="shrink-0"
                />
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
