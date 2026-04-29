import { useEffect, useMemo, useRef } from 'react'
import { Venue, PulseWithUser, User } from '@/lib/types'
import { Favorites } from '@/components/Favorites'
import { TrendingSections } from '@/components/TrendingSections'
import { MySpotsFeed } from '@/components/MySpotsFeed'
import { RecommendationsSection } from '@/components/RecommendationsSection'
import { LiveActivityFeed } from '@/components/LiveActivityFeed'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Star, Scales, Sparkle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { getTrendingSections } from '@/lib/venue-trending'
import { getRecommendations } from '@/lib/venue-recommendations'
import { getDayType, getPeakCategories, getTimeOfDay } from '@/lib/time-contextual-scoring'
import { getSmartVenueSort } from '@/lib/contextual-intelligence'
import { PromotedVenue, isPromotionActive, sortWithPromotions } from '@/lib/promoted-discoveries'
import type { Pulse } from '@/lib/types'
import type { ContentReport } from '@/lib/content-moderation'

interface TrendingTabProps {
  venues: Venue[]
  pulses: Pulse[]
  pulsesWithUsers: PulseWithUser[]
  favoriteVenues: Venue[]
  followedVenues: Venue[]
  userLocation: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  currentUser: User
  allUsers: User[]
  trendingSubTab: 'trending' | 'my-spots'
  promotions?: PromotedVenue[]
  onPromotionImpression?: (promotionId: string) => void
  onPromotionClick?: (promotionId: string) => void
  onSubTabChange: (tab: 'trending' | 'my-spots') => void
  onVenueClick: (venue: Venue) => void
  onToggleFavorite: (venueId: string) => void
  onToggleFollow: (venueId: string) => void
  onReaction: (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
  onReportPulse?: (report: ContentReport) => void
  isFavorite: (venueId: string) => boolean
  onCompareVenues?: (venueIds: string[]) => void
}

export function TrendingTab({
  venues,
  pulses,
  pulsesWithUsers,
  favoriteVenues,
  followedVenues,
  userLocation,
  unitSystem,
  currentUser,
  allUsers,
  trendingSubTab,
  onSubTabChange,
  onVenueClick,
  onToggleFavorite,
  onToggleFollow,
  onReaction,
  onReportPulse,
  isFavorite,
  promotions,
  onPromotionImpression,
  onPromotionClick,
  onCompareVenues,
}: TrendingTabProps) {
  const activePromotions = (promotions || []).filter(isPromotionActive)
  const seenPromotionImpressions = useRef<Set<string>>(new Set())
  const recommended = useMemo(() => {
    const base = getRecommendations(currentUser, venues, pulses, userLocation ?? undefined)
    if (base.length === 0 || activePromotions.length === 0) return base

    const promotedIds = new Set(activePromotions.map(promo => promo.venueId))
    const orderedVenues = sortWithPromotions(base.map(item => item.venue), promotedIds)
    const byVenueId = new Map(base.map(item => [item.venue.id, item]))
    return orderedVenues
      .map(venue => byVenueId.get(venue.id))
      .filter((item): item is NonNullable<typeof item> => !!item)
  }, [activePromotions, currentUser, pulses, userLocation, venues])

  const topVenueIdsForCompare = useMemo(() => {
    const now = new Date()
    const smartSorted = getSmartVenueSort(
      venues,
      currentUser,
      getTimeOfDay(now),
      getDayType(now)
    )
    return smartSorted.slice(0, 3).map(venue => venue.id)
  }, [currentUser, venues])

  useEffect(() => {
    for (const promotion of activePromotions.slice(0, 2)) {
      if (seenPromotionImpressions.current.has(promotion.id)) continue
      seenPromotionImpressions.current.add(promotion.id)
      onPromotionImpression?.(promotion.id)
    }
  }, [activePromotions, onPromotionImpression])

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1 p-1 bg-card/50 rounded-lg border border-border/50">
          <button
            onClick={() => onSubTabChange('trending')}
            className={cn(
              "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
              trendingSubTab === 'trending'
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Trending
          </button>
          <button
            onClick={() => onSubTabChange('my-spots')}
            className={cn(
              "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all relative",
              trendingSubTab === 'my-spots'
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            My Spots
            {followedVenues.length > 0 && trendingSubTab !== 'my-spots' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-[10px] font-bold">
                {followedVenues.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {trendingSubTab === 'trending' && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/16 via-card to-accent/10 p-5 shadow-lg shadow-primary/5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary/15 p-2.5 text-primary">
                <Sparkle size={22} weight="fill" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tonight's command center</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">Find the best move in seconds.</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Live crowd reports, friend activity, and venue momentum are ranked here so you do not have to guess.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare button */}
      {onCompareVenues && trendingSubTab === 'trending' && (
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-primary/20 text-primary hover:bg-primary/10"
            onClick={() => {
              onCompareVenues(topVenueIdsForCompare)
            }}
          >
            <Scales size={16} className="mr-2" />
            Compare Top Venues
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Side-by-side pulse, line, and live-intel context before you head out.
          </p>
        </div>
      )}

      {trendingSubTab === 'trending' && (
        <>
          {venues.length === 0 && (
            <div className="max-w-2xl mx-auto px-4 pt-4">
              <div className="rounded-2xl border border-border bg-card/70 p-6 text-center">
                <p className="font-semibold">No venues loaded yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Try refreshing, enabling location, or checking your Supabase connection.</p>
              </div>
            </div>
          )}

          <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Star size={20} weight="fill" className="text-accent" />
                  <h2 className="text-xl font-bold">Your saved spots</h2>
                </div>
                {favoriteVenues.length > 0 && (
                  <span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
                    {favoriteVenues.length} saved
                  </span>
                )}
              </div>
              <Favorites
                favoriteVenues={favoriteVenues}
                userLocation={userLocation}
                unitSystem={unitSystem}
                onVenueClick={onVenueClick}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
            <Separator className="mt-6" />
          </div>

          {/* Peak categories hint */}
          {(() => {
            const peakCats = getPeakCategories()
            if (peakCats.length === 0) return null
            return (
              <div className="max-w-2xl mx-auto px-4 pt-4 pb-2">
                <p className="text-xs text-muted-foreground">
                  Peak right now: {peakCats.join(' · ')}
                </p>
              </div>
            )
          })()}

          {/* Personalized recommendations */}
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <RecommendationsSection
              recommendations={recommended}
              onVenueClick={onVenueClick}
              promotions={activePromotions}
              onPromotionImpression={onPromotionImpression}
              onPromotionClick={onPromotionClick}
            />
          </div>

          {/* Friend Activity Feed */}
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <LiveActivityFeed
              currentUser={currentUser}
              allUsers={allUsers}
              venues={venues}
              pulses={pulses}
              onVenueClick={onVenueClick}
            />
          </div>

          <TrendingSections
            sections={getTrendingSections(venues, pulses)}
            userLocation={userLocation}
            onVenueClick={onVenueClick}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
        </>
      )}

      {trendingSubTab === 'my-spots' && (
        <MySpotsFeed
          followedVenues={followedVenues}
          pulses={pulsesWithUsers}
          userLocation={userLocation}
          unitSystem={unitSystem}
          currentUserId={currentUser.id}
          onVenueClick={onVenueClick}
          onToggleFollow={onToggleFollow}
          onReaction={onReaction}
          onReport={onReportPulse}
        />
      )}
    </>
  )
}
