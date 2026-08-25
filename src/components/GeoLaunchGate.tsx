import { MapPin } from '@phosphor-icons/react'
import type { LaunchedMarket } from '@/lib/geo-launch'

interface GeoLaunchGateProps {
  markets: LaunchedMarket[]
  venueCount: number
}

export function GeoLaunchGate({ markets, venueCount }: GeoLaunchGateProps) {
  const labels = markets.map((market) => market.label).join(', ')
  return (
    <aside
      className="rounded-2xl border border-border bg-card/80 p-4"
      data-testid="geo-launch-gate"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <MapPin size={18} weight="fill" className="mt-0.5 text-accent" aria-hidden />
        <div>
          <p className="text-sm font-semibold">Launch cities: {labels || 'none yet'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Venue discovery is geo-gated. Showing {venueCount} curated Seattle listings
            {markets.length > 0 ? ` for ${labels}` : ''}. Live reports appear only after real check-ins.
          </p>
        </div>
      </div>
    </aside>
  )
}
