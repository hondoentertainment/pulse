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
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getTrendingSections } from '@/lib/venue-trending'
import { getRecommendations } from '@/lib/venue-recommendations'
import { getPeakCategories } from '@/lib/time-contextual-scoring'
import { PromotedVenue, isPromotionActive } from '@/lib/promoted-discoveries'
import { PulseScore } from '@/components/PulseScore'
import type { Pulse } from '@/lib/types'

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
  onSubTabChange: (tab: 'trending' | 'my-spots') => void
  onVenueClick: (venue: Venue) => void
  onToggleFavorite: (venueId: string) => void
  onToggleFollow: (venueId: string) => void
  onReaction: (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
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
  allUsers: _allUsers,
  trendingSubTab,
  onSubTabChange,
  onVenueClick,
  onToggleFavorite,
  onToggleFollow,
  onReaction,
  isFavorite,
  promotions,
  onCompareVenues,
}: TrendingTabProps) {
  const activePromotions = (promotions || []).filter(isPromotionActive)

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

      {/* Compare button */}
      {onCompareVenues && trendingSubTab === 'trending' && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-primary/20 text-primary hover:bg-primary/10"
            onClick={() => {
              const topVenues = [...venues]
                .sort((a, b) => b.pulseScore - a.pulseScore)
                .slice(0, 3)
                .map(v => v.id)
              onCompareVenues(topVenues)
            }}
          >
            <Scales size={16} className="mr-2" />
            Compare Top Venues
          </Button>
        </div>
      )}

      {trendingSubTab === 'trending' && (
        <>
          {favoriteVenues.length > 0 && (
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Star size={20} weight="fill" className="text-accent" />
                  <h2 className="text-xl font-bold">Favorites</h2>
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
              recommendations={getRecommendations(currentUser, venues, pulses, userLocation ?? undefined)}
              onVenueClick={onVenueClick}
            />
          </div>

          {/* Friend Activity Feed */}
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Live Activity</h3>
              <ErrorBoundary fallback={<div className="p-2 text-xs text-muted-foreground">Unable to load</div>}>
                <LiveActivityFeed
                  venues={venues}
                  pulses={pulses}
                  onVenueTap={(venueId) => {
                    const venue = venues.find(v => v.id === venueId)
                    if (venue) onVenueClick(venue)
                  }}
                />
              </ErrorBoundary>
            </div>
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
                    onClick={() => onVenueClick(venue)}
                    className="w-full p-3 bg-card rounded-xl border border-yellow-500/20 flex items-center gap-3 hover:border-yellow-500/40 transition-colors text-left"
                  >
                    <PulseScore score={venue.pulseScore} size="sm" showLabel={false} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{venue.name}</p>
                        <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-500 flex-shrink-0">
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
        />
      )}
    </>
  )
}
