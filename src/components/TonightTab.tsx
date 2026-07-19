import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Pulse, User, Venue } from '@/lib/types'
import type { EnergyRating } from '@/lib/types'
import { ENERGY_CONFIG } from '@/lib/types'
import { getTonightPicks, type VibeFilter } from '@/lib/tonight-feed'
import { getActivePromotions, type PromotedVenue } from '@/lib/promoted-discoveries'
import { mergeTonightPicksWithSponsorship } from '@/lib/sponsorship-integrity'
import { getActiveStories, type PulseStory } from '@/lib/stories'
import { StoryRing } from '@/components/StoryRing'
import { TonightRecommendationCard } from '@/components/TonightRecommendationCard'
import { EnergyReportSheet } from '@/components/EnergyReportSheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tonightHeaderCopy } from '@/lib/value-prop'
import {
  startDecisionSession,
  trackDirectionsStarted,
  trackFilterApplied,
  trackGoSelected,
  trackRecommendationViewed,
  trackVenueSaved,
  trackVenueShared,
  trackVibeSelected,
} from '@/lib/decision-analytics'
import { trackEvent } from '@/lib/analytics'
import { generateVenueShareCard, buildNativeShareData, buildClipboardShareText } from '@/lib/sharing'
import { parseTonightVibeParam } from '@/lib/tonight-route'

const VIBE_OPTIONS: { id: VibeFilter; label: string; rating?: EnergyRating }[] = [
  { id: 'any', label: 'Any vibe' },
  { id: 'dead', label: 'Dead', rating: 'dead' },
  { id: 'chill', label: 'Chill', rating: 'chill' },
  { id: 'buzzing', label: 'Buzzing', rating: 'buzzing' },
  { id: 'electric', label: 'Electric', rating: 'electric' },
]

interface TonightTabProps {
  venues: Venue[]
  pulses: Pulse[]
  currentUser: User
  userLocation: { lat: number; lng: number } | null
  promotions?: PromotedVenue[]
  stories?: PulseStory[]
  isFavorite: (venueId: string) => boolean
  onVenueClick: (venue: Venue) => void
  onToggleFavorite: (venueId: string) => void
  onExplore?: () => void
  onQuickEnergyReport?: (venue: Venue, energy: EnergyRating) => void
  onStoryClick?: (stories: PulseStory[], index: number) => void
}

export function TonightTab({
  venues,
  pulses,
  currentUser,
  userLocation,
  promotions = [],
  stories = [],
  isFavorite,
  onVenueClick,
  onToggleFavorite,
  onExplore,
  onQuickEnergyReport,
  onStoryClick,
}: TonightTabProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const vibeFromUrl = searchParams.get('vibe')
  const initialVibe: VibeFilter = parseTonightVibeParam(
    vibeFromUrl,
    VIBE_OPTIONS.map((o) => o.id),
  )
  const [vibe, setVibe] = useState<VibeFilter>(initialVibe)
  const [reportVenue, setReportVenue] = useState<Venue | null>(null)

  useEffect(() => {
    startDecisionSession()
    trackEvent({ type: 'app_open', timestamp: Date.now() })
  }, [])

  useEffect(() => {
    setVibe(initialVibe)
    if (initialVibe !== 'any') {
      trackVibeSelected(initialVibe)
    }
  }, [initialVibe])

  const promotedVenueIds = useMemo(
    () => new Set(getActivePromotions(promotions).map((promo) => promo.venueId)),
    [promotions],
  )

  const picks = useMemo(() => {
    const organic = getTonightPicks(currentUser, venues, pulses, {
      vibe,
      userLocation: userLocation ?? undefined,
      limit: 10,
    })
    return mergeTonightPicksWithSponsorship(organic, promotedVenueIds)
  }, [currentUser, venues, pulses, vibe, userLocation, promotedVenueIds])

  useEffect(() => {
    picks.slice(0, 5).forEach((pick, index) => {
      trackRecommendationViewed(pick.recommendation.venue.id, index + 1, pick.confidence)
    })
  }, [picks])

  const handleVibeChange = (next: VibeFilter) => {
    setVibe(next)
    trackVibeSelected(next)
    trackFilterApplied(`vibe:${next}`)
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'any') nextParams.delete('vibe')
    else nextParams.set('vibe', next)
    setSearchParams(nextParams, { replace: true })
  }

  const openDirections = (venue: Venue) => {
    if (!venue.location) return
    trackDirectionsStarted(venue.id, { venueName: venue.name, pulseScore: venue.pulseScore })
    const url = `https://www.google.com/maps/dir/?api=1&destination=${venue.location.lat},${venue.location.lng}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleGo = (venue: Venue) => {
    trackGoSelected(venue.id, { venueName: venue.name, pulseScore: venue.pulseScore })
    trackEvent({
      type: 'venue_view',
      timestamp: Date.now(),
      venueId: venue.id,
      source: 'tonight',
    })
    onVenueClick(venue)
  }

  const handleSave = (venueId: string) => {
    trackVenueSaved(venueId)
    onToggleFavorite(venueId)
  }

  const handleShare = async (venue: Venue) => {
    const card = generateVenueShareCard(venue)
    const payload = buildNativeShareData(card)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(payload)
        trackVenueShared(venue.id, 'native')
        return
      } catch {
        /* fall through */
      }
    }
    await navigator.clipboard.writeText(buildClipboardShareText(card))
    trackVenueShared(venue.id, 'clipboard')
  }

  const header = tonightHeaderCopy()
  const activeStories = useMemo(
    () => getActiveStories(stories).filter((story) => story.photos.length > 0),
    [stories],
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5" data-testid="tonight-tab">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f59e0b]">
          {header.eyebrow}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{header.title}</h1>
        <p className="text-sm text-muted-foreground">{header.subtitle}</p>
      </header>

      {onStoryClick && activeStories.length > 0 && (
        <section aria-label="Tonight's photo stories" className="-mx-4" data-testid="tonight-story-ring">
          <StoryRing
            stories={activeStories}
            currentUserId={currentUser.id}
            onStoryClick={(userId) => {
              const userStories = activeStories.filter((s) => s.userId === userId)
              onStoryClick(userStories, 0)
            }}
          />
        </section>
      )}

      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
        role="radiogroup"
        aria-label="Desired energy level"
      >
        {VIBE_OPTIONS.map((option) => {
          const active = vibe === option.id
          const accent = option.rating ? ENERGY_CONFIG[option.rating].color : undefined
          return (
            <Button
              key={option.id}
              size="sm"
              variant={active ? 'default' : 'outline'}
              data-testid={`vibe-${option.id}`}
              className={cn(
                'shrink-0 min-h-11 rounded-full px-4 touch-manipulation transition-transform',
                active && 'scale-[1.03]',
                active && !accent && 'bg-primary text-primary-foreground',
                active && accent && 'text-white',
                !active && 'bg-card/60',
              )}
              style={active && accent ? { backgroundColor: accent, borderColor: accent } : undefined}
              role="radio"
              aria-checked={active}
              onClick={() => handleVibeChange(option.id)}
            >
              {option.label}
            </Button>
          )
        })}
      </div>

      {picks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
          <p className="font-semibold">No live reviews for this vibe</p>
          <p className="text-sm text-muted-foreground">
            Try another energy level or explore places that need a fresh check-in.
          </p>
          {onExplore && (
            <Button variant="secondary" className="min-h-11" onClick={onExplore}>
              Explore venues
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {picks.map((pick, index) => (
            <TonightRecommendationCard
              key={pick.recommendation.venue.id}
              pick={pick}
              pulses={pulses}
              priority={index === 0}
              isSaved={isFavorite(pick.recommendation.venue.id)}
              onGo={() => handleGo(pick.recommendation.venue)}
              onDirections={() => openDirections(pick.recommendation.venue)}
              onSave={() => handleSave(pick.recommendation.venue.id)}
              onShare={() => void handleShare(pick.recommendation.venue)}
              onReport={
                onQuickEnergyReport
                  ? () => setReportVenue(pick.recommendation.venue)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {onQuickEnergyReport && (
        <EnergyReportSheet
          open={Boolean(reportVenue)}
          venueName={reportVenue?.name ?? ''}
          onClose={() => setReportVenue(null)}
          onSubmit={(energy) => {
            if (reportVenue) onQuickEnergyReport(reportVenue, energy)
            setReportVenue(null)
          }}
        />
      )}
    </div>
  )
}
