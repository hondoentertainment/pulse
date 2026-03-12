import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ListChecks,
  ShareNetwork,
  Timer,
  Crown,
  CheckCircle,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ENERGY_CONFIG } from '@/lib/types'
import type { Venue, User, EnergyRating } from '@/lib/types'
import {
  createGroupPoll,
  voteOnPoll,
  getPollWinner,
  type GroupPoll,
} from '@/lib/social-coordination'

interface GroupPollSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venues: Venue[]
  currentUserId: string
  friends: User[]
}

export function GroupPollSheet({
  open,
  onOpenChange,
  venues,
  currentUserId,
  friends,
}: GroupPollSheetProps) {
  const [poll, setPoll] = useState<GroupPoll | null>(null)
  const [title, setTitle] = useState('')
  const [timeRemaining, setTimeRemaining] = useState('')

  // Use up to 4 venues for the poll
  const pollVenues = venues.slice(0, 4)

  const handleCreatePoll = useCallback(() => {
    if (!title.trim() || pollVenues.length === 0) return

    const newPoll = createGroupPoll(
      currentUserId,
      title.trim(),
      pollVenues.map(v => v.id),
      pollVenues.map(v => v.name)
    )
    setPoll(newPoll)
  }, [title, pollVenues, currentUserId])

  const handleVote = useCallback(
    (venueId: string) => {
      if (!poll) return
      setPoll(voteOnPoll(poll, venueId, currentUserId))
    },
    [poll, currentUserId]
  )

  const winnerId = poll ? getPollWinner(poll) : null

  // Timer countdown
  useEffect(() => {
    if (!poll || poll.status === 'closed') return

    const tick = () => {
      const remaining = new Date(poll.expiresAt).getTime() - Date.now()
      if (remaining <= 0) {
        setTimeRemaining('Ended')
        return
      }
      const hours = Math.floor(remaining / (60 * 60 * 1000))
      const mins = Math.floor((remaining % (60 * 60 * 1000)) / 60000)
      setTimeRemaining(hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`)
    }

    tick()
    const interval = setInterval(tick, 30_000)
    return () => clearInterval(interval)
  }, [poll])

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setPoll(null)
      setTitle('')
    }
  }, [open])

  const totalVotes = poll
    ? poll.venueOptions.reduce((sum, opt) => sum + opt.votes.length, 0)
    : 0

  function getEnergyForScore(score: number): EnergyRating {
    if (score >= 75) return 'electric'
    if (score >= 50) return 'buzzing'
    if (score >= 25) return 'chill'
    return 'dead'
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-t border-border/50">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ListChecks size={22} weight="fill" className="text-purple-400" />
            <DrawerTitle className="text-lg">
              {poll ? poll.title : 'Where should we go tonight?'}
            </DrawerTitle>
          </div>

          {poll && (
            <div className="flex items-center gap-2 mt-1">
              <Timer size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{timeRemaining}</span>
              <span className="text-xs text-muted-foreground">
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4">
          {/* Poll creation form */}
          {!poll && (
            <div className="space-y-3">
              <Input
                placeholder="Tonight's plan..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground"
                onKeyDown={e => e.key === 'Enter' && handleCreatePoll()}
              />

              <p className="text-xs text-muted-foreground">
                {pollVenues.length} venue{pollVenues.length !== 1 ? 's' : ''} will
                be added to the poll
              </p>

              <Button
                onClick={handleCreatePoll}
                disabled={!title.trim() || pollVenues.length === 0}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white"
              >
                Create Poll
              </Button>
            </div>
          )}

          {/* Venue option cards */}
          {poll && (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {poll.venueOptions.map((option, i) => {
                  const isWinner = option.venueId === winnerId && totalVotes > 0
                  const hasVoted = option.votes.includes(currentUserId)
                  const venue = pollVenues.find(v => v.id === option.venueId)
                  const energy = venue
                    ? getEnergyForScore(venue.pulseScore)
                    : 'dead'
                  const votePercent =
                    totalVotes > 0
                      ? Math.round((option.votes.length / totalVotes) * 100)
                      : 0

                  return (
                    <motion.button
                      key={option.venueId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, type: 'spring', stiffness: 300 }}
                      onClick={() => handleVote(option.venueId)}
                      className={cn(
                        'w-full relative overflow-hidden rounded-xl border p-3 text-left transition-all',
                        isWinner
                          ? 'border-purple-400/60 bg-purple-500/10'
                          : hasVoted
                            ? 'border-accent/40 bg-accent/5'
                            : 'border-border/50 bg-secondary/30 hover:bg-secondary/50'
                      )}
                    >
                      {/* Vote fill bar */}
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-purple-500/10"
                        initial={{ width: 0 }}
                        animate={{ width: `${votePercent}%` }}
                        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                      />

                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isWinner && (
                              <Crown
                                size={14}
                                weight="fill"
                                className="text-yellow-400 shrink-0"
                              />
                            )}
                            <span className="text-sm font-medium text-foreground truncate">
                              {option.venueName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: ENERGY_CONFIG[energy].color }}
                            >
                              {ENERGY_CONFIG[energy].emoji} {ENERGY_CONFIG[energy].label}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Voter avatars */}
                          {option.votes.length > 0 && (
                            <div className="flex -space-x-1.5">
                              {option.votes.slice(0, 3).map(voterId => {
                                const voter = friends.find(f => f.id === voterId)
                                return (
                                  <Avatar key={voterId} className="h-5 w-5 border border-card">
                                    <AvatarImage src={voter?.profilePhoto} />
                                    <AvatarFallback className="bg-muted text-[8px]">
                                      {(voter?.username ?? '??').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                )
                              })}
                            </div>
                          )}

                          {/* Vote count badge */}
                          <motion.div
                            key={option.votes.length}
                            initial={{ scale: 1.3 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          >
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] tabular-nums',
                                isWinner
                                  ? 'border-purple-400/50 text-purple-300'
                                  : 'border-border text-muted-foreground'
                              )}
                            >
                              {option.votes.length}
                            </Badge>
                          </motion.div>

                          {hasVoted && (
                            <CheckCircle
                              size={16}
                              weight="fill"
                              className="text-accent"
                            />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Share button */}
          {poll && (
            <Button
              variant="outline"
              className="w-full border-purple-400/30 text-purple-300 hover:bg-purple-500/10"
            >
              <ShareNetwork size={16} weight="bold" className="mr-2" />
              Share with friends
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
