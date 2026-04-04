import { Venue, Pulse, PulseWithUser, User } from '@/lib/types'
import { PulseStory, getActiveStories } from '@/lib/stories'
import { VenueEvent, getEventsSoon } from '@/lib/events'
import { getPeopleYouMayKnow } from '@/lib/social-graph'
import { StoryRing } from '@/components/StoryRing'
import { FriendSuggestions } from '@/components/FriendSuggestions'
import { EventCard } from '@/components/EventCard'
import { PredictiveSurgePanel } from '@/components/PredictiveSurgePanel'
import { Separator } from '@/components/ui/separator'
import { Compass, CalendarBlank, UsersThree, Trophy, ChartBar, MapTrifold, MusicNotes, GearSix, Lightning, Ticket, Sparkle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import ForYouFeed from '@/components/ForYouFeed'
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
      <div className="flex items-center gap-2">
        <Compass size={24} weight="fill" className="text-[#E1306C]" />
        <h2 className="text-xl font-semibold">Discover</h2>
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

      {/* Predictive Surge */}
      <PredictiveSurgePanel
        venues={venues}
        pulses={pulses}
        onVenueClick={onVenueClick}
      />

      {/* Phase 4: Mood Selector */}
      <MoodSelector
        onMoodSelect={setSelectedMood}
        selectedMood={selectedMood}
      />

      {/* Phase 4: For You Feed */}
      <ForYouFeed
        venues={venues}
        user={currentUser}
        pulses={pulses}
        userLocation={userLocation ?? null}
        onVenueClick={onVenueClick}
      />

      <Separator />

      {/* Night Planner CTA */}
      <button
        onClick={() => onNavigate('night-planner')}
        className="w-full bg-gradient-to-r from-[#833AB4]/10 via-[#E1306C]/10 to-[#F77737]/10 rounded-2xl p-4 border border-white/10 flex items-center gap-3 hover:border-[#E1306C]/40 transition-colors backdrop-blur-xl"
      >
        <Sparkle size={24} weight="fill" className="text-[#E1306C]" />
        <div className="flex-1 text-left">
          <p className="font-semibold text-sm">Plan Your Night</p>
          <p className="text-xs text-muted-foreground">AI-powered multi-stop itinerary</p>
        </div>
      </button>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction
          icon={<CalendarBlank size={24} weight="fill" />}
          label="Events"
          sublabel={upcomingEvents.length > 0 ? `${upcomingEvents.length} coming up` : 'Browse events'}
          color="from-[#405DE6]/20 to-[#833AB4]/20"
          borderColor="border-white/10"
          onClick={() => onNavigate('events')}
        />
        <QuickAction
          icon={<UsersThree size={24} weight="fill" />}
          label="Crews"
          sublabel="Group check-ins"
          color="from-[#833AB4]/20 to-[#E1306C]/20"
          borderColor="border-white/10"
          onClick={() => onNavigate('crews')}
        />
        <QuickAction
          icon={<Trophy size={24} weight="fill" />}
          label="Achievements"
          sublabel="Track your badges"
          color="from-[#FCAF45]/20 to-[#F77737]/20"
          borderColor="border-white/10"
          onClick={() => onNavigate('achievements')}
        />
        <QuickAction
          icon={<ChartBar size={24} weight="fill" />}
          label="Insights"
          sublabel="Your weekly recap"
          color="from-[#833AB4]/20 to-[#E1306C]/20"
          borderColor="border-white/10"
          onClick={() => onNavigate('insights')}
        />
        <QuickAction
          icon={<MusicNotes size={24} weight="fill" />}
          label="Playlists"
          sublabel="Curated pulse boards"
          color="from-[#E1306C]/20 to-[#F77737]/20"
          borderColor="border-white/10"
          onClick={() => onNavigate('playlists')}
        />
        <QuickAction
          icon={<Lightning size={24} weight="fill" />}
          label="Challenges"
          sublabel="Earn rewards"
          color="from-[#F77737]/20 to-[#FCAF45]/20"
          borderColor="border-white/10"
          onClick={() => onNavigate('challenges')}
        />
        <QuickAction
          icon={<Ticket size={24} weight="fill" />}
          label="My Tickets"
          sublabel="Tickets & reservations"
          color="from-[#405DE6]/20 to-[#833AB4]/20"
          borderColor="border-white/10"
          onClick={() => onNavigate('my-tickets')}
        />
        <QuickAction
          icon={<GearSix size={24} weight="fill" />}
          label="Settings"
          sublabel="Language, privacy & more"
          color="from-gray-500/20 to-slate-500/20"
          borderColor="border-white/10"
          onClick={() => onNavigate('settings')}
        />
      </div>

      {/* Neighborhood button */}
      <button
        onClick={() => onNavigate('neighborhoods')}
        className="w-full bg-gradient-to-r from-[#833AB4]/10 via-[#E1306C]/10 to-[#F77737]/10 rounded-2xl p-4 border border-white/10 flex items-center gap-3 hover:border-[#E1306C]/40 transition-colors backdrop-blur-xl"
      >
        <MapTrifold size={24} weight="fill" className="text-[#E1306C]" />
        <div className="flex-1 text-left">
          <p className="font-semibold text-sm">Neighborhood Scores</p>
          <p className="text-xs text-muted-foreground">See which areas are hottest right now</p>
        </div>
      </button>

      {/* Upcoming Events Preview */}
      {upcomingEvents.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Happening Soon</h3>
              <button onClick={() => onNavigate('events')} className="text-xs text-[#E1306C] font-semibold">
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
            <h3 className="font-semibold">People You May Know</h3>
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
      className={`bg-gradient-to-br ${color} rounded-2xl p-4 border ${borderColor} text-left backdrop-blur-xl`}
    >
      <div className="text-foreground mb-2">{icon}</div>
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </motion.button>
  )
}
