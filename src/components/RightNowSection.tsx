import { useMemo, type ReactNode } from 'react'
import { Compass, Lightning, MapPin, SealCheck, TrendUp } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { getEnergyLabel, getEnergyColor } from '@/lib/pulse-engine'
import { getRightNowDecisionSections, type RightNowDecision } from '@/lib/right-now-decisions'
import type { User, Venue } from '@/lib/types'

interface RightNowSectionProps {
  venues: Venue[]
  currentUser: User
  userLocation?: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
}

interface SectionConfig {
  id: 'surgingNow' | 'worthLeavingFor' | 'verifiedNearby'
  title: string
  subtitle: string
  icon: ReactNode
}

const SECTION_CONFIG: SectionConfig[] = [
  {
    id: 'surgingNow',
    title: 'Surging Now',
    subtitle: 'The strongest live momentum in the city right now.',
    icon: <Lightning size={18} weight="fill" className="text-yellow-400" />,
  },
  {
    id: 'worthLeavingFor',
    title: 'Worth Leaving For',
    subtitle: 'Good energy with a better-than-average shot at a smooth move.',
    icon: <Compass size={18} weight="fill" className="text-primary" />,
  },
  {
    id: 'verifiedNearby',
    title: 'Verified Nearby',
    subtitle: 'Close-by spots with owner-confirmed or active guest-reported intel.',
    icon: <SealCheck size={18} weight="fill" className="text-emerald-400" />,
  },
]

export function RightNowSection({
  venues,
  currentUser,
  userLocation,
  onVenueClick,
}: RightNowSectionProps) {
  const sections = useMemo(
    () => getRightNowDecisionSections(venues, currentUser, userLocation),
    [venues, currentUser, userLocation]
  )

  const hasAnyItems = Object.values(sections).some(items => items.length > 0)
  if (!hasAnyItems) {
    return (
      <div className="rounded-2xl border border-border bg-card/70 p-4">
        <div className="flex items-center gap-2">
          <TrendUp size={20} weight="fill" className="text-primary" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide">Right Now</h3>
            <p className="text-xs text-muted-foreground">Live signals are still warming up. Open the map or post the first pulse nearby.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
        <TrendUp size={20} weight="fill" className="text-primary" />
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide">Right Now</h3>
          <p className="text-xs text-muted-foreground">Pick the move, not just the place.</p>
        </div>
        </div>
      </div>

      {SECTION_CONFIG.map(section => {
        const items = sections[section.id]
        if (items.length === 0) return null

        return (
          <div key={section.id} className="space-y-2">
            <div className="flex items-center gap-2">
              {section.icon}
              <div>
                <h4 className="font-semibold text-sm">{section.title}</h4>
                <p className="text-xs text-muted-foreground">{section.subtitle}</p>
              </div>
            </div>
            <div className="grid gap-2">
              {items.map(item => (
                <RightNowCard
                  key={item.venue.id}
                  item={item}
                  onClick={() => onVenueClick(item.venue)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RightNowCard({ item, onClick }: { item: RightNowDecision; onClick: () => void }) {
  const energyColor = getEnergyColor(item.venue.pulseScore)
  const energyLabel = getEnergyLabel(item.venue.pulseScore)
  const waitLabel = item.liveData.waitTime === null
    ? item.freshnessLabel
    : item.liveData.waitTime === 0
      ? 'No wait reported'
      : `~${item.liveData.waitTime} min line`

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className="w-full rounded-2xl border border-border bg-card/90 p-4 text-left transition-colors hover:border-primary/30"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{item.venue.name}</p>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ color: energyColor, backgroundColor: `${energyColor}20` }}
            >
              {energyLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.venue.category ?? 'Venue'}{item.distanceMiles !== null ? ` • ${formatDistance(item.distanceMiles)}` : ''}
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pulse</p>
          <p className="text-sm font-bold text-primary">{item.venue.pulseScore}</p>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium">{item.headline}</p>
      <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <InfoPill label={item.sourceLabel} tone="verified" />
        <InfoPill label={waitLabel} tone="muted" />
        {item.liveData.doorMode.guestListStatus && (
          <InfoPill label={`Guest list ${item.liveData.doorMode.guestListStatus}`} tone="muted" />
        )}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">{item.trustLabel}</p>
    </motion.button>
  )
}

function InfoPill({ label, tone }: { label: string; tone: 'verified' | 'muted' }) {
  const className = tone === 'verified'
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    : 'border-border bg-background text-muted-foreground'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${className}`}>
      {tone === 'verified' ? <SealCheck size={12} weight="fill" /> : <MapPin size={12} weight="fill" />}
      {label}
    </span>
  )
}

function formatDistance(distanceMiles: number): string {
  if (distanceMiles < 0.1) return 'Here'
  if (distanceMiles < 10) return `${distanceMiles.toFixed(1)} mi away`
  return `${Math.round(distanceMiles)} mi away`
}
