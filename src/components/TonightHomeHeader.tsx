import type { Pulse, Venue } from '@/lib/types'
import { buildTonightHome } from '@/lib/tonight-home'
import { TrustGlanceRow } from '@/components/TrustGlanceRow'
import { TonightEmptyState } from '@/components/TonightEmptyState'
import { FeedTabBar } from '@/components/ux/FeedTabBar'
import { PulseActionRow } from '@/components/ux/PulseActionRow'
import { TimelineAvatar } from '@/components/ux/TimelineAvatar'
import { venueHandle } from '@/lib/venue-handle'
import type { MapHomeSurface } from '@/lib/ux-chrome'

const MAP_TABS = [
  { id: 'tonight' as const, label: 'Tonight' },
  { id: 'live' as const, label: 'Live' },
  { id: 'map' as const, label: 'Map' },
]

interface TonightHomeHeaderProps {
  venues: Venue[]
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  savedVenueIds?: readonly string[]
  locationDenied?: boolean
  onVenueClick: (venue: Venue) => void
  surface?: MapHomeSurface
  onSurfaceChange?: (surface: MapHomeSurface) => void
}

export function TonightHomeHeader({
  venues,
  pulses,
  userLocation,
  savedVenueIds = [],
  locationDenied,
  onVenueClick,
  surface = 'map',
  onSurfaceChange,
}: TonightHomeHeaderProps) {
  const home = buildTonightHome({
    venues,
    pulses,
    userLocation,
    savedVenueIds,
    locationDenied,
  })

  return (
    <section aria-labelledby="tonight-home-heading">
      <header className="space-y-1">
        <h1 id="tonight-home-heading" className="text-[20px] font-bold tracking-tight text-foreground">
          {home.title}
        </h1>
        <p className="text-[13px] text-muted-foreground">{home.subtitle}</p>
      </header>

      {onSurfaceChange && (
        <FeedTabBar
          tabs={MAP_TABS}
          value={surface}
          onChange={onSurfaceChange}
          ariaLabel="Map home views"
          className="mt-3"
        />
      )}

      {(!onSurfaceChange || surface === 'tonight') && (
        <div className="pt-1">
          {home.startHere && (
            <TonightFeedRow
              venue={home.startHere.venue}
              kicker={home.startHere.suggested ? 'Start here · Launch 33' : 'Start here'}
              headline={home.startHere.headline}
              pulses={pulses}
              onVenueClick={onVenueClick}
            />
          )}

          {home.heatingUp.length > 0 && (
            <div>
              <h2 className="pt-3 text-[13px] font-semibold text-muted-foreground">Also heating up</h2>
              {home.heatingUp.map((pick) => (
                <TonightFeedRow
                  key={pick.venue.id}
                  venue={pick.venue}
                  kicker={pick.energyLabel}
                  headline={pick.headline}
                  pulses={pulses}
                  onVenueClick={onVenueClick}
                />
              ))}
            </div>
          )}

          {home.empty && <TonightEmptyState empty={home.empty} />}
        </div>
      )}
    </section>
  )
}

function TonightFeedRow({
  venue,
  kicker,
  headline,
  pulses,
  onVenueClick,
}: {
  venue: Venue
  kicker: string
  headline: string
  pulses: Pulse[]
  onVenueClick: (venue: Venue) => void
}) {
  const open = () => onVenueClick(venue)
  return (
    <article className="flex gap-3 border-b border-border py-3">
      <TimelineAvatar name={venue.name} />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={open} className="block w-full text-left">
          <div className="flex min-w-0 items-baseline gap-1">
            <span className="truncate text-[15px] font-bold text-foreground">{venue.name}</span>
            <span className="truncate text-[13px] text-muted-foreground">{venueHandle(venue.name)}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-primary">{kicker}</p>
          <p className="mt-0.5 text-[15px] leading-5 text-foreground">{headline}</p>
          <div className="mt-1.5">
            <TrustGlanceRow venue={venue} pulses={pulses} />
          </div>
        </button>
        <PulseActionRow onReply={open} onShare={open} />
      </div>
    </article>
  )
}
