import { useEffect, useMemo, useRef, useState } from 'react'
import { Venue, PulseWithUser, User } from '@/lib/types'
import { Favorites } from '@/components/Favorites'
import { TrendingSections } from '@/components/TrendingSections'
import { MySpotsFeed } from '@/components/MySpotsFeed'
import { RecommendationsSection } from '@/components/RecommendationsSection'
import { LiveActivityFeed } from '@/components/LiveActivityFeed'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Megaphone, Scales } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { getTrendingSections } from '@/lib/venue-trending'
import { getRecommendations } from '@/lib/venue-recommendations'
import { getDayType, getPeakCategories, getTimeOfDay } from '@/lib/time-contextual-scoring'
import { getSmartVenueSort } from '@/lib/contextual-intelligence'
import { PromotedVenue, isPromotionActive, sortWithPromotions } from '@/lib/promoted-discoveries'
import { PulseScore } from '@/components/PulseScore'
import { Skeleton } from '@/components/ui/skeleton'
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
  const [activeSection, setActiveSection] = useState(0)
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

  const trendingSections = useMemo(
    () => getTrendingSections(venues, pulses),
    [venues, pulses]
  )

  return (
    <div className="pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1 p-1 bg-card/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg">
          <button
            onClick={() => onSubTabChange('trending')}
            className={cn(
              "flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all",
              trendingSubTab === 'trending'
                ? "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Trending
          </button>
          <button
            onClick={() => onSubTabChange('my-spots')}
            className={cn(
              "flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all relative",
              trendingSubTab === 'my-spots'
                ? "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            My Spots
            {followedVenues.length > 0 && trendingSubTab !== 'my-spots' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E1306C] text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                {followedVenues.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Compare button */}
      {onCompareVenues && trendingSubTab === 'trending' && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-[#833AB4]/20 text-[#833AB4] hover:bg-[#833AB4]/10"
            onClick={() => {
              onCompareVenues(topVenueIdsForCompare)
            }}
          >
            <Scales size={16} className="mr-2" />
            Compare Top Venues
          </Button>
        </div>
      )}

      {trendingSubTab === 'trending' && (
        <>
          {venues.length === 0 && (
            <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="w-full h-32 rounded-xl" />
              ))}
            </div>
          )}

          {favoriteVenues.length > 0 && (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Star size={20} weight="fill" className="text-[#FCAF45]" />
                  <h2 className="text-xl font-semibold">Favorites</h2>
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
          )}

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
              maxItems={3}
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
              maxItems={5}
            />
          </div>

          {/* Promoted Venues */}
          {activePromotions.length > 0 && (
            <div className="max-w-2xl mx-auto px-4 pt-4 space-y-2">
              {activePromotions.slice(0, 2).map(promo => {
                const venue = venues.find(v => v.id === promo.venueId)
                if (!venue) return null
                return (
                  <button
                    key={promo.id}
                    onClick={() => {
                      onPromotionClick?.(promo.id)
                      onVenueClick(venue)
                    }}
                    className="w-full p-3 bg-card/95 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-3 hover:border-[#FCAF45]/40 transition-colors text-left shadow-lg"
                  >
                    <PulseScore score={venue.pulseScore} size="sm" showLabel={false} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{venue.name}</p>
                        <Badge variant="outline" className="text-[10px] border-[#FCAF45]/40 text-[#FCAF45] flex-shrink-0">
                          <Megaphone size={8} className="mr-0.5" />
                          Sponsored
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{venue.category}{venue.city ? ` · ${venue.city}` : ''}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Trending category tabs */}
          {trendingSections.length > 0 && (
            <div className="max-w-2xl mx-auto px-4 pt-4">
              {/* Sticky tab bar */}
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-3 -mx-4 px-4 pt-2">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {trendingSections.map((section, idx) => (
                    <button
                      key={section.title}
                      onClick={() => setActiveSection(idx)}
                      className={cn(
                        "flex-shrink-0 px-4 py-2 text-sm font-medium transition-all whitespace-nowrap",
                        activeSection === idx
                          ? "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white rounded-full"
                          : "bg-card/90 border border-white/10 rounded-full text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active section content */}
              <TrendingSections
                sections={[trendingSections[activeSection]]}
                userLocation={userLocation}
                onVenueClick={onVenueClick}
                isFavorite={isFavorite}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          )}
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
    </div>
  )
}
