import { useNavigate } from 'react-router-dom'
import type { Pulse, Venue } from '@/lib/types'
import { buildShareOgCard } from '@/lib/sharing'
import { formatTimeAgo, getEnergyLabel } from '@/lib/pulse-engine'
import { ENERGY_CONFIG } from '@/lib/types'
import { getImHereMapPath } from '@/lib/sharing'
import { getVenueMapActivity } from '@/lib/map-live-reviews'

interface ShareArrivalCardProps {
  venue: Venue
  pulses: Pulse[]
}

export function ShareArrivalCard({ venue, pulses }: ShareArrivalCardProps) {
  const navigate = useNavigate()
  const activity = getVenueMapActivity(venue, pulses)
  const energyLabel = activity.latest
    ? ENERGY_CONFIG[activity.latest.energyRating].label
    : getEnergyLabel(venue.pulseScore)
  const freshness = activity.latest ? formatTimeAgo(activity.latest.createdAt) : undefined
  const card = buildShareOgCard({
    venueName: venue.name,
    energyLabel,
    freshness,
    caption: activity.latest?.caption,
  })

  return (
    <section className="space-y-3" aria-label={card.eyebrow}>
      <p className="text-xs font-medium text-muted-foreground">{card.eyebrow}</p>
      <div className="rounded-[18px] bg-[#17171C] p-3.5">
        <h2 className="text-[22px] font-bold text-white">{card.title}</h2>
        <p className="mt-1 text-sm font-semibold text-primary">{card.energyLine}</p>
        {card.caption && (
          <p className="mt-2 text-sm text-white">{card.caption}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => navigate(getImHereMapPath(venue.id))}
        className="h-12 w-full rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground"
      >
        {card.cta}
      </button>
      <p className="text-xs text-muted-foreground">OG preview matches this card</p>
    </section>
  )
}
