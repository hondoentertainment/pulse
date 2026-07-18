import { Venue, Pulse, PulseWithUser, User } from '@/lib/types'
import { PulseStory, getActiveStories } from '@/lib/stories'
import { VenueEvent, getEventsSoon } from '@/lib/events'
import { getPeopleYouMayKnow } from '@/lib/social-graph'
import { StoryRing } from '@/components/StoryRing'
import { FriendSuggestions } from '@/components/FriendSuggestions'
import { EventCard } from '@/components/EventCard'
import { PredictiveSurgePanel } from '@/components/PredictiveSurgePanel'
import { RightNowSection } from '@/components/RightNowSection'
import { TonightsRecapBanner } from '@/components/TonightsRecapBanner'
import { Separator } from '@/components/ui/separator'
import {
  CaretDown,
  CalendarBlank,
  UsersThree,
  Trophy,
  ChartBar,
  MapTrifold,
  MusicNotes,
  GearSix,
  Lightning,
  Ticket,
  Sparkle,
  UserCircle,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import MoodSelector from '@/components/MoodSelector'
import type { MoodType } from '@/lib/personalization-engine'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface DiscoverTabProps {
  venues: Venue[]
  pulses: Pulse[]
  pulsesWithUsers: PulseWithUser[]
  currentUser: User
  allUsers: User[]
  stories: PulseStory[]
  events: VenueEvent[]
  userLocation?: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
  onStoryClick: (stories: PulseStory[], index: number) => void
  onAddFriend: (userId: string) => void
  onNavigate: (page: 'events' | 'crews' | 'achievements' | 'insights' | 'dashboard' | 'neighborhoods' | 'playlists' | 'settings' | 'integrations' | 'challenges' | 'my-tickets' | 'night-planner') => void
  isFollowed: (venueId: string) => boolean
  onToggleFollow: (venueId: string) => void
}

export function DiscoverTab({
  venues,
  pulses,
  pulsesWithUsers: _pulsesWithUsers,
  currentUser,
  allUsers,
  stories,
  events,
  onVenueClick,
  onStoryClick,
  userLocation,
  onAddFriend,
  onNavigate,
  isFollowed,
  onToggleFollow,
}: DiscoverTabProps) {
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const activeStories = getActiveStories(stories)
  const upcomingEvents = getEventsSoon(events, 12).slice(0, 3)
  const suggestions = getPeopleYouMayKnow(currentUser, allUsers, pulses).slice(0, 5)
  const ticketingEnabled = isFeatureEnabled('ticketing')
  const aiConciergeEnabled = isFeatureEnabled('aiConcierge')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Explore</p>
        <h2 className="text-2xl font-bold tracking-tight">See it. Decide. Go.</h2>
        <p className="text-sm text-muted-foreground">
          Stories and right-now places first — live reviews fade in 90 minutes.
        </p>
      </header>

      {/* Stories — Instagram-style primacy */}
      {activeStories.length > 0 && (
        <StoryRing
          stories={activeStories}
          currentUserId={currentUser.id}
          onStoryClick={(userId) => {
            const userStories = activeStories.filter((s) => s.userId === userId)
            onStoryClick(userStories, 0)
          }}
        />
      )}

      <RightNowSection
        venues={venues}
        pulses={pulses}
        currentUser={currentUser}
        userLocation={userLocation ?? null}
        onVenueClick={onVenueClick}
        isFollowed={isFollowed}
        onToggleFollow={onToggleFollow}
      />

      <PredictiveSurgePanel
        venues={venues}
        pulses={pulses}
        events={events}
        onVenueClick={onVenueClick}
      />

      <MoodSelector onMoodSelect={setSelectedMood} selectedMood={selectedMood} />

      <TonightsRecapBanner currentUser={currentUser} pulses={pulses} venues={venues} />

      {/* Upcoming Events Preview — still useful, before More */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Happening Soon</h3>
            <button
              type="button"
              onClick={() => onNavigate('events')}
              className="min-h-11 text-xs text-primary font-medium touch-manipulation"
            >
              See All
            </button>
          </div>
          {upcomingEvents.map((event) => {
            const venue = venues.find((v) => v.id === event.venueId)
            return (
              <EventCard
                key={event.id}
                event={event}
                venueName={venue?.name || 'Unknown'}
                currentUserId={currentUser.id}
                onRSVP={() => {}}
              />
            )
          })}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold">People You May Know</h3>
          <FriendSuggestions suggestions={suggestions} onAddFriend={onAddFriend} />
        </div>
      )}

      <Separator />

      {/* Collapsed secondary tools — not in first viewport */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className="flex w-full min-h-11 items-center justify-between rounded-2xl border border-border bg-card/60 px-4 py-3 text-left touch-manipulation"
          aria-expanded={moreOpen}
        >
          <div>
            <p className="font-medium text-sm">More</p>
            <p className="text-xs text-muted-foreground">Events, crews, planner, settings</p>
          </div>
          <CaretDown
            size={18}
            className={cn('text-muted-foreground transition-transform', moreOpen && 'rotate-180')}
          />
        </button>

        <AnimatePresence initial={false}>
          {moreOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3"
            >
              {aiConciergeEnabled && (
                <button
                  type="button"
                  onClick={() => onNavigate('night-planner')}
                  className="w-full rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/12 to-accent/10 p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left min-h-11 touch-manipulation"
                >
                  <Sparkle size={24} weight="fill" className="text-primary" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">Plan Your Night</p>
                    <p className="text-xs text-muted-foreground">
                      AI-powered multi-stop itinerary
                    </p>
                  </div>
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <QuickAction
                  icon={<CalendarBlank size={24} weight="fill" />}
                  label="Events"
                  sublabel={upcomingEvents.length > 0 ? `${upcomingEvents.length} coming up` : 'Browse events'}
                  color="from-primary/14 to-accent/10"
                  borderColor="border-primary/20"
                  onClick={() => onNavigate('events')}
                />
                <QuickAction
                  icon={<UsersThree size={24} weight="fill" />}
                  label="Crews"
                  sublabel="Group check-ins"
                  color="from-accent/14 to-primary/10"
                  borderColor="border-accent/20"
                  onClick={() => onNavigate('crews')}
                />
                <QuickAction
                  icon={<Trophy size={24} weight="fill" />}
                  label="Achievements"
                  sublabel="Track your badges"
                  color="from-accent/14 to-card"
                  borderColor="border-accent/20"
                  onClick={() => onNavigate('achievements')}
                />
                <QuickAction
                  icon={<UserCircle size={24} weight="fill" />}
                  label="My Dashboard"
                  sublabel="History that guides you"
                  color="from-primary/16 to-accent/12"
                  borderColor="border-primary/25"
                  onClick={() => onNavigate('dashboard')}
                />
                <QuickAction
                  icon={<ChartBar size={24} weight="fill" />}
                  label="Insights"
                  sublabel="Your weekly recap"
                  color="from-primary/14 to-card"
                  borderColor="border-primary/20"
                  onClick={() => onNavigate('insights')}
                />
                <QuickAction
                  icon={<MusicNotes size={24} weight="fill" />}
                  label="Playlists"
                  sublabel="Curated boards"
                  color="from-primary/12 to-accent/10"
                  borderColor="border-primary/20"
                  onClick={() => onNavigate('playlists')}
                />
                <QuickAction
                  icon={<Lightning size={24} weight="fill" />}
                  label="Challenges"
                  sublabel="Earn rewards"
                  color="from-accent/14 to-card"
                  borderColor="border-accent/20"
                  onClick={() => onNavigate('challenges')}
                />
                {ticketingEnabled && (
                  <QuickAction
                    icon={<Ticket size={24} weight="fill" />}
                    label="My Tickets"
                    sublabel="Tickets & reservations"
                    color="from-primary/14 to-card"
                    borderColor="border-primary/20"
                    onClick={() => onNavigate('my-tickets')}
                  />
                )}
                <QuickAction
                  icon={<GearSix size={24} weight="fill" />}
                  label="Settings"
                  sublabel="Language, privacy & more"
                  color="from-muted/40 to-card"
                  borderColor="border-border"
                  onClick={() => onNavigate('settings')}
                />
              </div>

              <button
                type="button"
                onClick={() => onNavigate('neighborhoods')}
                className="w-full rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10 p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left min-h-11 touch-manipulation"
              >
                <MapTrifold size={24} weight="fill" className="text-primary" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">Neighborhood Scores</p>
                  <p className="text-xs text-muted-foreground">See which areas are hottest right now</p>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function QuickAction({
  icon,
  label,
  sublabel,
  color,
  borderColor,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  sublabel: string
  color: string
  borderColor: string
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      aria-label={`${label}: ${sublabel}`}
      className={`bg-gradient-to-br ${color} rounded-2xl p-4 border ${borderColor} text-left transition-colors hover:border-primary/35 min-h-11 touch-manipulation`}
    >
      <div className="text-foreground mb-2">{icon}</div>
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </motion.button>
  )
}
