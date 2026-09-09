import { Venue, Pulse } from '@/lib/types'
import { EnergyBadge } from '@/components/EnergyBadge'
import { formatDistance } from '@/lib/units'
import { calculateDistance, getEnergyLabel } from '@/lib/pulse-engine'
import { PULSE_DECAY_MINUTES } from '@/lib/types'

interface SurgingNearbyListProps {
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  onVenueClick: (venue: Venue) => void
}

function pulsesInWindow(pulses: Pulse[], venueId: string, minutes: number): number {
  const cutoff = Date.now() - minutes * 60 * 1000
  return pulses.filter(
    (pulse) => pulse.venueId === venueId && new Date(pulse.createdAt).getTime() >= cutoff,
  ).length
}

export function SurgingNearbyList({
  venues,
  pulses,
  userLocation,
  unitSystem,
  onVenueClick,
}: SurgingNearbyListProps) {
  const nearby = [...venues]
    .filter((venue) => venue.pulseScore >= 40)
    .sort((a, b) => b.pulseScore - a.pulseScore)
    .slice(0, 6)

  if (nearby.length === 0) return null

  return (
    <section aria-labelledby="surging-nearby-heading" className="space-y-3">
      <h2 id="surging-nearby-heading" className="text-xl font-bold">
        Surging nearby
      </h2>
      <div className="space-y-3">
        {nearby.map((venue) => {
          const distance = userLocation
            ? calculateDistance(
                userLocation.lat,
                userLocation.lng,
                venue.location.lat,
                venue.location.lng,
              )
            : undefined
          const recentCount = pulsesInWindow(pulses, venue.id, PULSE_DECAY_MINUTES)
          const neighborhood = venue.neighborhood || venue.city
          const meta = [
            distance !== undefined ? formatDistance(distance, unitSystem) : null,
            neighborhood,
            recentCount > 0 ? `${recentCount} pulses / ${PULSE_DECAY_MINUTES}m` : null,
          ]
            .filter(Boolean)
            .join(' · ')

          return (
            <button
              key={venue.id}
              type="button"
              onClick={() => onVenueClick(venue)}
              className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-white/10 bg-card/80 px-4 py-3.5 text-left transition-colors hover:border-white/20"
            >
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-foreground">{venue.name}</h3>
                {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
              </div>
              <EnergyBadge
                label={getEnergyLabel(venue.pulseScore)}
                className="shrink-0"
              />
            </button>
          )
        })}
      </div>
    </section>
  )
}
