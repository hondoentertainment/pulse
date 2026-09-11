import { useNavigate } from 'react-router-dom'
import type { Pulse, Venue } from '@/lib/types'
import { buildShareOgCard, getImHereMapPath } from '@/lib/sharing'
import { formatTimeAgo, getEnergyLabel } from '@/lib/pulse-engine'
import { ENERGY_CONFIG } from '@/lib/types'
import { getVenueMapActivity } from '@/lib/map-live-reviews'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { resolveImHereAction } from '@/lib/im-here'
import { UX_CARD, UX_CTA } from '@/lib/ux-chrome'

interface ShareArrivalCardProps {
  venue: Venue
  pulses: Pulse[]
}

export function ShareArrivalCard({ venue, pulses }: ShareArrivalCardProps) {
  const navigate = useNavigate()
  const { session, isPlaceholder } = useSupabaseAuth()
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
      <div className={`${UX_CARD} p-3.5`}>
        <h2 className="text-[22px] font-bold text-foreground">{card.title}</h2>
        <p className="mt-1 text-sm font-semibold text-primary">{card.energyLine}</p>
        {card.caption && (
          <p className="mt-2 text-sm text-foreground">{card.caption}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          const action = resolveImHereAction({
            venueId: venue.id,
            isPlaceholder,
            hasSession: Boolean(session),
          })
          navigate(action.openCreate ? getImHereMapPath(venue.id, { create: true }) : action.mapPath)
        }}
        className={UX_CTA}
      >
        {card.cta}
      </button>
      <p className="text-xs text-muted-foreground">
        OG preview matches this card · guests can view the pin, writes go to /auth
      </p>
    </section>
  )
}
