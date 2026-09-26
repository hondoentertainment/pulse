import { useNavigate } from 'react-router-dom'
import type { Pulse, Venue } from '@/lib/types'
import { buildShareOgCard, getImHereMapPath } from '@/lib/sharing'
import { formatTimeAgo, getEnergyLabel } from '@/lib/pulse-engine'
import { ENERGY_CONFIG } from '@/lib/types'
import { getVenueMapActivity } from '@/lib/map-live-reviews'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { resolveImHereAction } from '@/lib/im-here'
import { UX_CARD, UX_CTA } from '@/lib/ux-chrome'
import { InstallAffordance } from '@/components/InstallAffordance'
import { SignalPill } from '@/components/ux/SignalPill'
import { toneForEnergy } from '@/lib/signal-tone'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'

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
  const place = [venue.neighborhood, venue.city].filter(Boolean).join(' · ')

  return (
    <section className="space-y-3" aria-label={card.eyebrow}>
      <div className="rounded-2xl border border-[rgba(115,209,255,0.4)] bg-[rgba(115,209,255,0.12)] p-3.5">
        <p className="text-[13px] font-semibold text-accent">{card.eyebrow}</p>
        <p className="mt-1 text-[12px] text-foreground">
          You’re on {venue.name} · skip Welcome
        </p>
      </div>
      <div>
        <h2 className="text-[26px] font-bold text-foreground">{card.title}</h2>
        {place && (
          <p className="mt-1 text-[13px] text-muted-foreground">{place}</p>
        )}
      </div>
      <div className={`${UX_CARD} p-3.5`}>
        <div className="flex items-center gap-3.5">
          <p className="text-[48px] font-bold leading-none text-foreground">{venue.pulseScore}</p>
          <div>
            <SignalPill tone={toneForEnergy(activity.latest?.energyRating ?? energyLabel.toLowerCase())}>
              {energyLabel}
            </SignalPill>
            <div className="mt-1 flex flex-wrap items-center gap-x-1 text-[12px] text-muted-foreground">
              {(() => {
                const recent = pulses.filter((pulse) => {
                  const age = Date.now() - new Date(pulse.createdAt).getTime()
                  return age >= 0 && age < 10 * 60 * 1000
                }).length
                const delta = recent * 8
                return delta > 0 ? <span>+{delta} / 10m ·</span> : null
              })()}
              <ScoreBreakdown venue={venue} pulses={pulses} inline />
            </div>
          </div>
        </div>
      </div>
      {card.caption && (
        <p className="text-[14px] text-foreground">{card.caption}</p>
      )}
      <InstallAffordance surface="share" />
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={card.cta}
          onClick={() => {
            const action = resolveImHereAction({
              venueId: venue.id,
              isPlaceholder,
              hasSession: Boolean(session),
            })
            navigate(action.openCreate ? getImHereMapPath(venue.id, { create: true }) : action.mapPath)
          }}
          className={`${UX_CTA} flex-1`}
        >
          I’m here
        </button>
        <button
          type="button"
          onClick={() => {
            const action = resolveImHereAction({
              venueId: venue.id,
              isPlaceholder,
              hasSession: Boolean(session),
            })
            if (action.authRedirect) {
              navigate(action.authRedirect)
              return
            }
            navigate(getImHereMapPath(venue.id, { create: true }))
          }}
          className="h-12 flex-1 rounded-[14px] border border-border bg-card px-3 text-[13px] font-semibold text-foreground"
        >
          Post a live review
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        OG preview matches this card. Install only when this browser can add Pulse. Guests can view the pin; posting goes to /auth.
      </p>
    </section>
  )
}
