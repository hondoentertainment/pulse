import { Venue, PulseWithUser, User } from '@/lib/types'
import { Favorites } from '@/components/Favorites'
import { TrendingSections } from '@/components/TrendingSections'
import { MySpotsFeed } from '@/components/MySpotsFeed'
import { RecommendationsSection } from '@/components/RecommendationsSection'
import { Separator } from '@/components/ui/separator'
import { Star } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { getTrendingSections } from '@/lib/venue-trending'
import { getRecommendations } from '@/lib/venue-recommendations'
import { getPeakCategories } from '@/lib/time-contextual-scoring'
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
  trendingSubTab: 'trending' | 'my-spots'
  onSubTabChange: (tab: 'trending' | 'my-spots') => void
  onVenueClick: (venue: Venue) => void
  onToggleFavorite: (venueId: string) => void
  onToggleFollow: (venueId: string) => void
  onReaction: (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
  isFavorite: (venueId: string) => boolean
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
  trendingSubTab,
  onSubTabChange,
  onVenueClick,
  onToggleFavorite,
  onToggleFollow,
  onReaction,
  isFavorite
}: TrendingTabProps) {
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
