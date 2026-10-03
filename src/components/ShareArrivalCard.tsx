import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Pulse, Venue } from '@/lib/types'
import { buildShareOgCard, getImHereMapPath } from '@/lib/sharing'
import { formatTimeAgo, getEnergyColor, getEnergyLabel } from '@/lib/pulse-engine'
import { ENERGY_CONFIG } from '@/lib/types'
import { getVenueMapActivity } from '@/lib/map-live-reviews'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { AuthRequiredError } from '@/lib/auth/require-auth'
import { AUTH_PATH } from '@/lib/guest-discovery'
import { resolveImHereAction } from '@/lib/im-here'
import { confirmImHere } from '@/lib/im-here-confirm'
import { UX_CARD, UX_CTA } from '@/lib/ux-chrome'
import { InstallAffordance } from '@/components/InstallAffordance'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'

interface ShareArrivalCardProps {
  venue: Venue
  pulses: Pulse[]
  userLocation?: { lat: number; lng: number } | null
}

export function ShareArrivalCard({ venue, pulses, userLocation }: ShareArrivalCardProps) {
  const navigate = useNavigate()
  const { session, isPlaceholder } = useSupabaseAuth()
  const confirming = useRef(false)
  const [busy, setBusy] = useState(false)
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

  const handleImHere = async () => {
    if (confirming.current) return
    const hasSession = Boolean(session)
    const action = resolveImHereAction({
      venueId: venue.id,
      isPlaceholder,
      hasSession,
    })
    const mapPath = action.openCreate
      ? getImHereMapPath(venue.id, { create: true })
      : action.mapPath

    if (!hasSession) {
      navigate(mapPath)
      return
    }

    confirming.current = true
    setBusy(true)
    try {
      await confirmImHere({
        venueId: venue.id,
        venueName: venue.name,
        signedIn: true,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
      })
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        navigate(action.authRedirect ?? AUTH_PATH)
        return
      }
      console.warn('[pulse] share im-here confirm failed', error)
    } finally {
      confirming.current = false
      setBusy(false)
    }
    navigate(mapPath)
  }

  return (
    <section id="energy" className="space-y-3" aria-label={card.eyebrow}>
      <div>
        <p className="text-[12px] font-semibold leading-4 text-accent">{card.eyebrow}</p>
        <h1 className="mt-1.5 text-[28px] font-bold leading-9 text-foreground">{card.title}</h1>
        <div className="mt-1 flex items-center justify-between gap-3 text-[13px] leading-[17px]">
          {place ? (
            <p className="min-w-0 text-muted-foreground">{place}</p>
          ) : <span />}
          <button
            type="button"
            className="shrink-0 font-semibold text-accent"
            onClick={() => navigate('/')}
          >
            Skip Welcome
          </button>
        </div>
      </div>
      <div className={`${UX_CARD} p-3.5`}>
        <div className="flex flex-nowrap items-center gap-3.5">
          <p className="shrink-0 text-[40px] font-bold leading-[44px] text-foreground">{venue.pulseScore}</p>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-[21px]" style={{ color: getEnergyColor(venue.pulseScore) }}>{energyLabel}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[12px] text-muted-foreground">
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
      <p className="text-[12px] leading-4 text-muted-foreground">
        OG preview matches this card. Install only when this browser can add Pulse. Guests can view the pin; posting goes to /auth.
      </p>
      {card.caption && (
        <p className="text-[14px] text-foreground">{card.caption}</p>
      )}
      <InstallAffordance surface="share" />
      <div className="fixed inset-x-0 z-40 mx-auto w-full max-w-2xl space-y-2 bg-background px-4 pb-2 pt-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]">
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
          className="flex h-12 w-full items-center justify-center rounded-[14px] border border-white/15 bg-background px-3 text-[14px] font-semibold text-foreground"
        >
          Post a live review
        </button>
        <button
          type="button"
          aria-label={card.cta}
          aria-busy={busy}
          disabled={busy}
          onClick={() => { void handleImHere() }}
          className={`${UX_CTA} disabled:opacity-70`}
        >
          I’m here
        </button>
      </div>
    </section>
  )
}
