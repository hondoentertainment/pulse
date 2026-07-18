import { useMemo } from 'react'
import type { User, Pulse, Venue, EnergyRating } from '@/lib/types'
import { buildPersonalDashboard, type ChoiceGuide } from '@/lib/personal-dashboard'
import {
  CaretLeft,
  Compass,
  Clock,
  Fire,
  Lightning,
  MapPin,
  Path,
  Sparkle,
  ArrowRight,
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PersonalDashboardPageProps {
  currentUser: User
  pulses: Pulse[]
  venues: Venue[]
  onBack: () => void
  onVenueClick: (venue: Venue) => void
  onGoTonight: (vibe?: EnergyRating) => void
  onOpenInsights?: () => void
  onOpenDiscover?: () => void
}

const KIND_ICON: Record<ChoiceGuide['kind'], typeof Sparkle> = {
  return: Path,
  explore: Compass,
  vibe: Lightning,
  time: Clock,
  fresh: Sparkle,
  taste: Fire,
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Visit logged'
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function PersonalDashboardPage({
  currentUser,
  pulses,
  venues,
  onBack,
  onVenueClick,
  onGoTonight,
  onOpenInsights,
  onOpenDiscover,
}: PersonalDashboardPageProps) {
  const dashboard = useMemo(
    () => buildPersonalDashboard(currentUser, venues, pulses),
    [currentUser, venues, pulses],
  )

  const venueById = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues])

  const handleGuide = (guide: ChoiceGuide) => {
    if (guide.cta === 'tonight') {
      onGoTonight(guide.suggestedVibe ?? dashboard.suggestedVibe ?? undefined)
      return
    }
    if (guide.cta === 'discover') {
      onOpenDiscover?.()
      return
    }
    if (guide.venueId) {
      const venue = venueById.get(guide.venueId)
      if (venue) onVenueClick(venue)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button type="button" onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg" aria-label="Back">
            <CaretLeft size={24} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">Your Dashboard</h1>
            <p className="text-xs text-muted-foreground truncate">
              History that steers @{currentUser.username}&apos;s night
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-background to-accent/10 p-5"
        >
          <p className="text-xs uppercase tracking-wide text-primary font-medium">For you</p>
          <h2 className="text-2xl font-bold mt-1">
            {dashboard.empty ? 'Build your history' : 'Choose from your patterns'}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {dashboard.empty
              ? 'Check in and pulse a few spots — we turn that into picks that match how you actually go out.'
              : `${dashboard.summary.uniqueVenues} spots · ${dashboard.summary.totalVisits} visits` +
                (dashboard.summary.preferredEnergy
                  ? ` · usually ${dashboard.summary.preferredEnergy}`
                  : '')}
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            {dashboard.summary.topCategories.map((cat) => (
              <Badge key={cat.category} variant="secondary" className="text-xs">
                {cat.label}
              </Badge>
            ))}
            {dashboard.summary.peakHourLabel && (
              <Badge variant="outline" className="text-xs">
                Peak: {dashboard.summary.peakHourLabel}
              </Badge>
            )}
          </div>

          <Button
            className="mt-5 w-full sm:w-auto"
            onClick={() => onGoTonight(dashboard.suggestedVibe ?? undefined)}
          >
            Open Tonight picks
            <ArrowRight size={16} className="ml-1" />
          </Button>
        </motion.section>

        {dashboard.choiceGuides.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-bold text-lg">Direct your night</h3>
            <div className="space-y-2">
              {dashboard.choiceGuides.map((guide, i) => {
                const Icon = KIND_ICON[guide.kind]
                return (
                  <motion.button
                    key={guide.id}
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleGuide(guide)}
                    className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors flex gap-3"
                  >
                    <div className="mt-0.5 text-primary shrink-0">
                      <Icon size={22} weight="fill" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{guide.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{guide.reason}</p>
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground shrink-0 mt-1" />
                  </motion.button>
                )
              })}
            </div>
          </section>
        )}

        {dashboard.summary.goToVenues.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-bold text-lg">Your go-tos</h3>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              {dashboard.summary.goToVenues.map((entry) => {
                const venue = venueById.get(entry.venueId)
                if (!venue) return null
                return (
                  <button
                    key={entry.venueId}
                    type="button"
                    onClick={() => onVenueClick(venue)}
                    className="shrink-0 w-40 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-primary mb-2">
                      <MapPin size={14} weight="fill" />
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {entry.visitCount}×
                      </span>
                    </div>
                    <p className="font-medium text-sm truncate">{entry.venueName}</p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      Score {entry.pulseScore}
                    </p>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-lg">Visit history</h3>
            {onOpenInsights && (
              <button
                type="button"
                onClick={onOpenInsights}
                className="text-xs text-primary font-medium hover:underline"
              >
                Full insights
              </button>
            )}
          </div>

          {dashboard.history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Compass size={36} className="mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No visits yet. Pulse a venue and it shows up here to guide your next choice.
              </p>
              <Button variant="secondary" className="mt-4" onClick={() => onGoTonight()}>
                Browse Tonight
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {dashboard.history.map((entry, i) => {
                const venue = venueById.get(entry.venueId)
                return (
                  <motion.li
                    key={entry.venueId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <button
                      type="button"
                      disabled={!venue}
                      onClick={() => venue && onVenueClick(venue)}
                      className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left hover:border-primary/30 disabled:opacity-60 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <MapPin size={18} weight="fill" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{entry.venueName}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.visitCount} visit{entry.visitCount === 1 ? '' : 's'}
                          {entry.lastEnergy ? ` · last felt ${entry.lastEnergy}` : ''}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatRelative(entry.lastVisitAt)}
                      </span>
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
