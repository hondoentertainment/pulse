import { Users, CheckCircle, Clock, Trophy } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Crew, CrewCheckIn, CrewActivityFeed } from '@/lib/crew-mode'
import { getConfirmedCount, isSquadGoals } from '@/lib/crew-mode'
import { ENERGY_CONFIG } from '@/lib/types'
import type { EnergyRating } from '@/lib/types'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface CrewPanelProps {
  crew: Crew
  activeCheckIn?: CrewCheckIn
  activityFeed?: CrewActivityFeed
  members: { id: string; username: string; profilePhoto?: string }[]
  currentUserId: string
  onConfirmCheckIn?: (energyRating: EnergyRating) => void
}

export function CrewPanel({
  crew,
  activeCheckIn,
  activityFeed,
  members,
  currentUserId,
  onConfirmCheckIn,
}: CrewPanelProps) {
  const memberMap = new Map(members.map(m => [m.id, m]))

  return (
    <div className="space-y-3">
      {/* Crew header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} weight="fill" className="text-accent" />
          <h3 className="text-sm font-bold text-foreground">{crew.name}</h3>
          <span className="text-xs text-muted-foreground">
            {crew.memberIds.length} members
          </span>
        </div>
        {activityFeed && activityFeed.squadGoalsCount > 0 && (
          <Badge variant="outline" className="text-[10px] border-yellow-400/50 text-yellow-400">
            <Trophy size={10} weight="fill" className="mr-0.5" />
            Squad Goals x{activityFeed.squadGoalsCount}
          </Badge>
        )}
      </div>

      {/* Member avatars */}
      <div className="flex -space-x-2">
        {crew.memberIds.map(id => {
          const member = memberMap.get(id)
          const isConfirmed = activeCheckIn?.confirmations[id]?.confirmed
          return (
            <div key={id} className="relative">
              <Avatar className={cn(
                "h-8 w-8 border-2",
                isConfirmed ? "border-accent" : "border-background"
              )}>
                <AvatarImage src={member?.profilePhoto} />
                <AvatarFallback className="bg-muted text-[10px]">
                  {(member?.username ?? '??').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isConfirmed && (
                <CheckCircle size={12} weight="fill" className="absolute -bottom-0.5 -right-0.5 text-accent bg-background rounded-full" />
              )}
            </div>
          )
        })}
      </div>

      {/* Active check-in */}
      {activeCheckIn && (
        <Card className="p-3 bg-card/80 border-accent/30">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={12} weight="fill" className="text-accent" />
                <span className="text-xs font-medium text-foreground">Active Check-In</span>
              </div>
              {isSquadGoals(activeCheckIn) && (
                <Badge className="text-[9px] bg-yellow-400/20 text-yellow-400 border-yellow-400/30">
                  <Trophy size={9} weight="fill" className="mr-0.5" />
                  Squad Goals!
                </Badge>
              )}
            </div>

            {(() => {
              const { confirmed, total } = getConfirmedCount(activeCheckIn)
              return (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${(confirmed / total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{confirmed}/{total}</span>
                </div>
              )
            })()}

            {activeCheckIn.combinedEnergyRating && (
              <div className="flex items-center gap-1.5 text-xs">
                <span>Crew energy:</span>
                <span style={{ color: ENERGY_CONFIG[activeCheckIn.combinedEnergyRating].color }}>
                  {ENERGY_CONFIG[activeCheckIn.combinedEnergyRating].emoji} {ENERGY_CONFIG[activeCheckIn.combinedEnergyRating].label}
                </span>
              </div>
            )}

            {!activeCheckIn.confirmations[currentUserId]?.confirmed && onConfirmCheckIn && (
              <div className="flex gap-1.5 mt-1">
                {(['chill', 'buzzing', 'electric'] as EnergyRating[]).map(rating => (
                  <Button
                    key={rating}
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] flex-1"
                    onClick={() => onConfirmCheckIn(rating)}
                  >
                    {ENERGY_CONFIG[rating].emoji} {ENERGY_CONFIG[rating].label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Activity feed */}
      {activityFeed && activityFeed.entries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Tonight</p>
          {activityFeed.entries.map((entry, i) => (
            <motion.div
              key={`${entry.venueId}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 text-xs"
            >
              <span style={{ color: ENERGY_CONFIG[entry.combinedEnergy].color }}>
                {ENERGY_CONFIG[entry.combinedEnergy].emoji}
              </span>
              <span className="text-foreground font-medium">{entry.venueName}</span>
              <span className="text-muted-foreground">
                {entry.membersPresent}/{entry.totalMembers}
              </span>
              {entry.isSquadGoals && <Trophy size={10} weight="fill" className="text-yellow-400" />}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
