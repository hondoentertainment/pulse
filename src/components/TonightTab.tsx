import { useEffect, useMemo, useState } from 'react'
import type { Pulse, User, Venue } from '@/lib/types'
import type { EnergyRating } from '@/lib/types'
import { ENERGY_CONFIG } from '@/lib/types'
import { getTonightPicks, type VibeFilter } from '@/lib/tonight-feed'
import { TonightRecommendationCard } from '@/components/TonightRecommendationCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  isFavorite: (venueId: string) => boolean
  onVenueClick: (venue: Venue) => void
  onToggleFavorite: (venueId: string) => void
  onExplore?: () => void
}

export function TonightTab({
  venues,
  pulses,
  currentUser,
  userLocation,
  isFavorite,
  onVenueClick,
  onToggleFavorite,
  onExplore,
}: TonightTabProps) {
  const [vibe, setVibe] = useState<VibeFilter>('any')

  useEffect(() => {
    startDecisionSession()
    trackEvent({ type: 'app_open', timestamp: Date.now() })
  }, [])

  const picks = useMemo(
    () =>
      getTonightPicks(currentUser, venues, pulses, {
        vibe,
        userLocation: userLocation ?? undefined,
        limit: 10,
      }),
    [currentUser, venues, pulses, vibe, userLocation],
  )

  useEffect(() => {
    picks.slice(0, 5).forEach((pick, index) => {
      trackRecommendationViewed(pick.recommendation.venue.id, index + 1, pick.confidence)
    })
  }, [picks])

  const handleVibeChange = (next: VibeFilter) => {
    setVibe(next)
    trackVibeSelected(next)
    trackFilterApplied(`vibe:${next}`)
  }

  const openDirections = (venue: Venue) => {
    if (!venue.location) return
    trackDirectionsStarted(venue.id)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${venue.location.lat},${venue.location.lng}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleGo = (venue: Venue) => {
    trackGoSelected(venue.id)
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5" data-testid="tonight-tab">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Tonight</h1>
        <p className="text-sm text-muted-foreground">
          Pick your vibe — we&apos;ll show where to go right now with live confidence.
        </p>
      </header>

      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        role="group"
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
              className={cn('shrink-0 min-h-9', active && !accent && 'bg-primary')}
              style={active && accent ? { backgroundColor: accent, borderColor: accent } : undefined}
              aria-pressed={active}
              onClick={() => handleVibeChange(option.id)}
            >
              {option.label}
            </Button>
          )
        })}
      </div>

      {picks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
          <p className="font-semibold">No live signal for this vibe</p>
          <p className="text-sm text-muted-foreground">
            Try another energy level or explore the neighborhood list for venues without recent
            confirmations.
          </p>
          {onExplore && (
            <Button variant="secondary" onClick={onExplore}>
              Explore venues
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {picks.map((pick) => (
            <TonightRecommendationCard
              key={pick.recommendation.venue.id}
              pick={pick}
              isSaved={isFavorite(pick.recommendation.venue.id)}
              onGo={() => handleGo(pick.recommendation.venue)}
              onDirections={() => openDirections(pick.recommendation.venue)}
              onSave={() => handleSave(pick.recommendation.venue.id)}
              onShare={() => void handleShare(pick.recommendation.venue)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
