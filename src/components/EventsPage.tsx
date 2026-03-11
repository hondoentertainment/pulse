import { useMemo, useState } from 'react'
import { Venue } from '@/lib/types'
import { VenueEvent, getUpcomingEvents, getUserEvents, rsvpToEvent, predictEventSurge, getEventsSoon, RSVPStatus } from '@/lib/events'
import { EventCard } from '@/components/EventCard'
import { CaretLeft, CalendarBlank, Lightning } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface EventsPageProps {
  venues: Venue[]
  events: VenueEvent[]
  currentUserId: string
  onBack: () => void
  onEventUpdate: (events: VenueEvent[]) => void
  onVenueClick: (venue: Venue) => void
}

export function EventsPage({ venues, events, currentUserId, onBack, onEventUpdate, onVenueClick }: EventsPageProps) {
  const [filter, setFilter] = useState<'all' | 'mine' | 'soon'>('all')

  const filteredEvents = useMemo(() => {
    const now = new Date()
    switch (filter) {
      case 'mine':
        return getUserEvents(events, currentUserId)
      case 'soon':
        return getEventsSoon(events, 6)
      default:
        return events.filter(e => new Date(e.endTime) > now).sort((a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )
    }
  }, [events, currentUserId, filter])

  const handleRSVP = (eventId: string, status: RSVPStatus) => {
    const updated = events.map(e =>
      e.id === eventId ? rsvpToEvent(e, currentUserId, status) : e
    )
    onEventUpdate(updated)
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <CaretLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <CalendarBlank size={24} weight="fill" className="text-primary" />
            <h1 className="text-xl font-bold">Events</h1>
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-3 max-w-2xl mx-auto">
          {(['all', 'soon', 'mine'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border"
              )}
            >
              {f === 'all' ? 'Upcoming' : f === 'soon' ? 'Happening Soon' : 'My Events'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {filteredEvents.map((event, i) => {
          const venue = venues.find(v => v.id === event.venueId)
          const prediction = predictEventSurge(event)
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <EventCard
                event={event}
                venueName={venue?.name || 'Unknown Venue'}
                currentUserId={currentUserId}
                prediction={prediction}
                onRSVP={(_eventId, status) => handleRSVP(event.id, status)}
                onShare={() => {
                  if (venue) onVenueClick(venue)
                }}
              />
            </motion.div>
          )
        })}

        {filteredEvents.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <CalendarBlank size={48} className="mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">No events found</p>
            <p className="text-sm text-muted-foreground/70">
              {filter === 'mine' ? 'RSVP to events to see them here' : 'Check back later for upcoming events'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
