import { Venue, Pulse, PulseWithUser, User } from '@/lib/types'
import { PulseStory, getActiveStories } from '@/lib/stories'
import { VenueEvent, getEventsSoon } from '@/lib/events'
import { getPeopleYouMayKnow } from '@/lib/social-graph'
import { StoryRing } from '@/components/StoryRing'
import { FriendSuggestions } from '@/components/FriendSuggestions'
import { EventCard } from '@/components/EventCard'
import { PredictiveSurgePanel } from '@/components/PredictiveSurgePanel'
import { Separator } from '@/components/ui/separator'
import { Compass, CalendarBlank, UsersThree, Trophy, ChartBar, MapTrifold, MusicNotes, GearSix } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface DiscoverTabProps {
  venues: Venue[]
  pulses: Pulse[]
  pulsesWithUsers: PulseWithUser[]
  currentUser: User
  allUsers: User[]
  stories: PulseStory[]
  events: VenueEvent[]
  onVenueClick: (venue: Venue) => void
  onStoryClick: (stories: PulseStory[], index: number) => void
  onAddFriend: (userId: string) => void
  onNavigate: (page: 'events' | 'crews' | 'achievements' | 'insights' | 'neighborhoods' | 'playlists' | 'settings' | 'integrations') => void
}

export function DiscoverTab({
  venues,
  pulses,
  pulsesWithUsers,
  currentUser,
  allUsers,
  stories,
  events,
  onVenueClick,
  onStoryClick,
  onAddFriend,
  onNavigate
}: DiscoverTabProps) {
  const activeStories = getActiveStories(stories)
  const upcomingEvents = getEventsSoon(events, 12).slice(0, 3)
  const suggestions = getPeopleYouMayKnow(currentUser, allUsers, pulses).slice(0, 5)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Compass size={24} weight="fill" className="text-primary" />
        <h2 className="text-xl font-bold">Discover</h2>
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

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction
          icon={<CalendarBlank size={24} weight="fill" />}
          label="Events"
          sublabel={upcomingEvents.length > 0 ? `${upcomingEvents.length} coming up` : 'Browse events'}
          color="from-blue-500/20 to-cyan-500/20"
          borderColor="border-blue-500/20"
          onClick={() => onNavigate('events')}
        />
        <QuickAction
          icon={<UsersThree size={24} weight="fill" />}
          label="Crews"
          sublabel="Group check-ins"
          color="from-green-500/20 to-emerald-500/20"
          borderColor="border-green-500/20"
          onClick={() => onNavigate('crews')}
        />
        <QuickAction
          icon={<Trophy size={24} weight="fill" />}
          label="Achievements"
          sublabel="Track your badges"
          color="from-yellow-500/20 to-orange-500/20"
          borderColor="border-yellow-500/20"
          onClick={() => onNavigate('achievements')}
        />
        <QuickAction
          icon={<ChartBar size={24} weight="fill" />}
          label="Insights"
          sublabel="Your weekly recap"
          color="from-purple-500/20 to-pink-500/20"
          borderColor="border-purple-500/20"
          onClick={() => onNavigate('insights')}
        />
        <QuickAction
          icon={<MusicNotes size={24} weight="fill" />}
          label="Playlists"
          sublabel="Curated pulse boards"
          color="from-rose-500/20 to-red-500/20"
          borderColor="border-rose-500/20"
          onClick={() => onNavigate('playlists')}
        />
        <QuickAction
          icon={<GearSix size={24} weight="fill" />}
          label="Settings"
          sublabel="Language, privacy & more"
          color="from-gray-500/20 to-slate-500/20"
          borderColor="border-gray-500/20"
          onClick={() => onNavigate('settings')}
        />
      </div>

      {/* Neighborhood button */}
      <button
        onClick={() => onNavigate('neighborhoods')}
        className="w-full bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl p-4 border border-primary/20 flex items-center gap-3 hover:border-primary/40 transition-colors"
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
      className={`bg-gradient-to-br ${color} rounded-xl p-4 border ${borderColor} text-left`}
    >
      <div className="text-foreground mb-2">{icon}</div>
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </motion.button>
  )
}
