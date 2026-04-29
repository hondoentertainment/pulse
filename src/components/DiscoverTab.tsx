import { Venue, Pulse, PulseWithUser, User } from '@/lib/types'
import { PulseStory, getActiveStories } from '@/lib/stories'
import { VenueEvent, getEventsSoon } from '@/lib/events'
import { getPeopleYouMayKnow } from '@/lib/social-graph'
import { StoryRing } from '@/components/StoryRing'
import { FriendSuggestions } from '@/components/FriendSuggestions'
import { EventCard } from '@/components/EventCard'
import { PredictiveSurgePanel } from '@/components/PredictiveSurgePanel'
import { RightNowSection } from '@/components/RightNowSection'
import { Separator } from '@/components/ui/separator'
import { Compass, CalendarBlank, UsersThree, Trophy, ChartBar, MapTrifold, MusicNotes, GearSix, Lightning, Ticket, Sparkle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import MoodSelector from '@/components/MoodSelector'
import type { MoodType } from '@/lib/personalization-engine'
import { useState } from 'react'

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
  onNavigate: (page: 'events' | 'crews' | 'achievements' | 'insights' | 'neighborhoods' | 'playlists' | 'settings' | 'integrations' | 'challenges' | 'my-tickets' | 'night-planner') => void
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
  onNavigate
}: DiscoverTabProps) {
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null)
  const activeStories = getActiveStories(stories)
  const upcomingEvents = getEventsSoon(events, 12).slice(0, 3)
  const suggestions = getPeopleYouMayKnow(currentUser, allUsers, pulses).slice(0, 5)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="rounded-3xl border border-border bg-card/75 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/15 p-2.5 text-primary">
            <Compass size={24} weight="fill" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Discover</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Plan less. Move smarter.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with the right-now picks, then jump into events, crews, tickets, or your recap when you need more.
            </p>
          </div>
        </div>
      </div>

      {/* Stories */}
      {activeStories.length > 0 && (
        <>
          <StoryRing
            stories={activeStories}
            currentUserId={currentUser.id}
            onStoryClick={(userId) => {
              const userStories = activeStories.filter(s => s.userId === userId)
              onStoryClick(userStories, 0)
            }}
          />
          <Separator />
        </>
      )}

      <RightNowSection
        venues={venues}
        currentUser={currentUser}
        userLocation={userLocation ?? null}
        onVenueClick={onVenueClick}
      />

      <Separator />

      {/* Predictive Surge */}
      <PredictiveSurgePanel
        venues={venues}
        pulses={pulses}
        events={events}
        onVenueClick={onVenueClick}
      />

      {/* Phase 4: Mood Selector */}
      <MoodSelector
        onMoodSelect={setSelectedMood}
        selectedMood={selectedMood}
      />

      <Separator />

      {/* Night Planner CTA */}
      <button
        onClick={() => onNavigate('night-planner')}
        className="w-full rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/12 to-accent/10 p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left"
      >
        <Sparkle size={24} weight="fill" className="text-primary" />
        <div className="flex-1 text-left">
          <p className="font-medium text-sm">Plan Your Night</p>
          <p className="text-xs text-muted-foreground">AI-powered multi-stop itinerary</p>
        </div>
      </button>

      {/* Quick Actions Grid */}
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
          sublabel="Curated pulse boards"
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
        <QuickAction
          icon={<Ticket size={24} weight="fill" />}
          label="My Tickets"
          sublabel="Tickets & reservations"
          color="from-primary/14 to-card"
          borderColor="border-primary/20"
          onClick={() => onNavigate('my-tickets')}
        />
        <QuickAction
          icon={<GearSix size={24} weight="fill" />}
          label="Settings"
          sublabel="Language, privacy & more"
          color="from-muted/40 to-card"
          borderColor="border-border"
          onClick={() => onNavigate('settings')}
        />
      </div>

      {/* Neighborhood button */}
      <button
        onClick={() => onNavigate('neighborhoods')}
        className="w-full rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10 p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left"
      >
        <MapTrifold size={24} weight="fill" className="text-primary" />
        <div className="flex-1 text-left">
          <p className="font-medium text-sm">Neighborhood Scores</p>
          <p className="text-xs text-muted-foreground">See which areas are hottest right now</p>
        </div>
      </button>

      {/* Upcoming Events Preview */}
      {upcomingEvents.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Happening Soon</h3>
              <button onClick={() => onNavigate('events')} className="text-xs text-primary font-medium">
                See All
              </button>
            </div>
            {upcomingEvents.map(event => {
              const venue = venues.find(v => v.id === event.venueId)
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
        </>
      )}

      {/* Friend Suggestions */}
      {suggestions.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="font-bold">People You May Know</h3>
            <FriendSuggestions
              suggestions={suggestions}
              onAddFriend={onAddFriend}
            />
          </div>
        </>
      )}
    </div>
  )
}

function QuickAction({
  icon,
  label,
  sublabel,
  color,
  borderColor,
  onClick
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
      className={`bg-gradient-to-br ${color} rounded-2xl p-4 border ${borderColor} text-left transition-colors hover:border-primary/35`}
    >
      <div className="text-foreground mb-2">{icon}</div>
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </motion.button>
  )
}
