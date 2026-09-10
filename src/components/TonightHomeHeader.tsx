import type { Pulse, Venue } from '@/lib/types'
import { buildTonightHome } from '@/lib/tonight-home'
import { TrustGlanceRow } from '@/components/TrustGlanceRow'

interface TonightHomeHeaderProps {
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  savedVenueIds?: readonly string[]
  onVenueClick: (venue: Venue) => void
}

export function TonightHomeHeader({
  venues,
  pulses,
  userLocation,
  savedVenueIds = [],
  onVenueClick,
}: TonightHomeHeaderProps) {
  const home = buildTonightHome({
    venues,
    pulses,
    userLocation,
    savedVenueIds,
  })

  return (
    <section aria-labelledby="tonight-home-heading" className="space-y-3">
      <header>
        <h1 id="tonight-home-heading" className="text-[24px] font-bold tracking-tight text-white">
          {home.title}
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{home.subtitle}</p>
      </header>

      {home.startHere && (
        <button
          type="button"
          onClick={() => onVenueClick(home.startHere!.venue)}
          className="w-full rounded-[18px] bg-[#17171C] p-3.5 text-left"
        >
          <p className="text-xs font-medium text-primary">Start here</p>
          <p className="mt-1 text-lg font-bold text-white">{home.startHere.headline}</p>
          <div className="mt-1">
            <TrustGlanceRow venue={home.startHere.venue} pulses={pulses} />
          </div>
        </button>
      )}

      {home.heatingUp.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-white">Also heating up</h2>
          {home.heatingUp.map((pick) => (
            <button
              key={pick.venue.id}
              type="button"
              onClick={() => onVenueClick(pick.venue)}
              className="w-full rounded-[18px] bg-[#17171C] px-3.5 py-3 text-left text-sm font-semibold text-white"
            >
              {pick.venue.name} · {pick.energyLabel}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
