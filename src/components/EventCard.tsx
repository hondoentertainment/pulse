import { Calendar, Clock, Users, Ticket, Lightning } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { VenueEvent, RSVPStatus, EventSurgePrediction } from '@/lib/events'
import { getRSVPCounts, getUserRSVP, EVENT_CATEGORIES } from '@/lib/events'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface EventCardProps {
  event: VenueEvent
  venueName: string
  currentUserId: string
  prediction?: EventSurgePrediction
  onRSVP: (eventId: string, status: RSVPStatus) => void
  onShare?: (eventId: string) => void
}

export function EventCard({ event, venueName, currentUserId, prediction, onRSVP, onShare: _onShare }: EventCardProps) {
  const counts = getRSVPCounts(event)
  const userStatus = getUserRSVP(event, currentUserId)
  const catInfo = EVENT_CATEGORIES.find(c => c.value === event.category)

  const startDate = new Date(event.startTime)
  const endDate = new Date(event.endTime)
  const isToday = new Date().toDateString() === startDate.toDateString()
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === startDate.toDateString()

  const dateLabel = isToday
    ? 'Today'
    : isTomorrow
    ? 'Tomorrow'
    : startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const timeLabel = `${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
      <Card className="p-4 bg-card/80 border-border hover:border-accent/40 transition-colors">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg">{catInfo?.emoji ?? '✨'}</span>
                <h4 className="font-bold text-sm text-foreground">{event.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{venueName}</p>
            </div>
            {prediction && (
              <Badge
                variant="outline"
                className="text-[10px] border-accent/50 text-accent shrink-0"
              >
                <Lightning size={10} weight="fill" className="mr-0.5" />
                {prediction.label}
              </Badge>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar size={12} weight="fill" />
              {dateLabel}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} weight="fill" />
              {timeLabel}
            </span>
            {event.coverCharge !== undefined && event.coverCharge > 0 && (
              <span className="flex items-center gap-1">
                <Ticket size={12} weight="fill" />
                ${event.coverCharge}
              </span>
            )}
          </div>

          {event.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
          )}

          {/* RSVP counts and buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users size={12} weight="fill" />
                {counts.going} going
              </span>
              {counts.interested > 0 && (
                <span>{counts.interested} interested</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={userStatus === 'going' ? 'default' : 'outline'}
                className={cn(
                  "h-7 px-2.5 text-xs",
                  userStatus === 'going' && "bg-accent text-accent-foreground hover:bg-accent/90"
                )}
                onClick={() => onRSVP(event.id, userStatus === 'going' ? 'not_going' : 'going')}
              >
                Going
              </Button>
              <Button
                size="sm"
                variant={userStatus === 'interested' ? 'default' : 'outline'}
                className={cn(
                  "h-7 px-2.5 text-xs",
                  userStatus === 'interested' && "bg-primary text-primary-foreground"
                )}
                onClick={() => onRSVP(event.id, userStatus === 'interested' ? 'not_going' : 'interested')}
              >
                Interested
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
