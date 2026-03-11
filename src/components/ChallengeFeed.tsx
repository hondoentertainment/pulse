import { useState, useMemo } from 'react'
import { Venue } from '@/lib/types'
import {
  VenueChallenge,
  getActiveChallenges,
  getUserActiveChallenges,
  getChallengeTimeRemaining,
} from '@/lib/venue-challenges'
import { Separator } from '@/components/ui/separator'
import {
  CaretLeft,
  Trophy,
  Clock,
  MapPin,
  Users,
  Camera,
  Lightning,
  HashStraight,
  FunnelSimple,
  CurrencyDollar,
  Star,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

type FilterType = 'all' | 'highest-reward' | 'ending-soon'

interface ChallengeFeedProps {
  challenges: VenueChallenge[]
  venues: Venue[]
  currentUserId: string
  onBack: () => void
  onJoinChallenge: (challengeId: string) => void
}

export function ChallengeFeed({
  challenges,
  venues,
  currentUserId,
  onBack,
  onJoinChallenge,
}: ChallengeFeedProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  const userChallenges = useMemo(
    () => getUserActiveChallenges(challenges, currentUserId),
    [challenges, currentUserId]
  )

  const activeChallenges = useMemo(() => {
    const active = getActiveChallenges(challenges)

    switch (filter) {
      case 'highest-reward':
        return [...active].sort((a, b) => b.reward.value - a.reward.value)
      case 'ending-soon':
        return [...active].sort(
          (a, b) =>
            new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
        )
      default:
        return active
    }
  }, [challenges, filter])

  const rewardTypeIcon: Record<string, React.ReactNode> = {
    cash: <CurrencyDollar size={14} weight="fill" className="text-green-400" />,
    'vip-access': <Star size={14} weight="fill" className="text-purple-400" />,
    'free-drinks': <Lightning size={14} weight="fill" className="text-blue-400" />,
    merch: <Trophy size={14} weight="fill" className="text-yellow-400" />,
  }

  const challengeTypeLabel: Record<string, string> = {
    'post-from-venue': 'Post & Share',
    'best-vibe-shot': 'Photo Contest',
    'bring-your-crew': 'Group Challenge',
    'weekly-regular': 'Weekly Regular',
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <CaretLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Trophy size={24} weight="fill" className="text-yellow-400" />
            <h1 className="text-xl font-bold">Challenges</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Your Active Challenges */}
        {userChallenges.length > 0 && (
          <>
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Your Active Challenges</h2>
              {userChallenges.map(challenge => {
                const venue = venues.find(v => v.id === challenge.venueId)
                const timeLeft = getChallengeTimeRemaining(challenge)
                const hasSubmitted = challenge.entries.some(
                  e => e.userId === currentUserId
                )

                return (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl p-4 border border-primary/20 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm">{challenge.title}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin size={12} />
                          <span>{venue?.name ?? challenge.sponsorVenueName}</span>
                        </div>
                      </div>
                      {hasSubmitted ? (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-medium">
                          Submitted
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-medium">
                          In Progress
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {timeLeft.expired
                          ? 'Expired'
                          : `${timeLeft.days}d ${timeLeft.hours}h left`}
                      </span>
                      <span className="flex items-center gap-1">
                        {rewardTypeIcon[challenge.reward.type]}
                        {challenge.reward.description}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
            <Separator />
          </>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2">
          <FunnelSimple size={16} className="text-muted-foreground" />
          {(['all', 'highest-reward', 'ending-soon'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f === 'all'
                ? 'All'
                : f === 'highest-reward'
                  ? 'Top Rewards'
                  : 'Ending Soon'}
            </button>
          ))}
        </div>

        {/* Challenge List */}
        <AnimatePresence mode="popLayout">
          {activeChallenges.length === 0 ? (
            <div className="text-center py-12">
              <Trophy size={48} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                No active challenges right now. Check back soon!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeChallenges.map((challenge, i) => {
                const venue = venues.find(v => v.id === challenge.venueId)
                const timeLeft = getChallengeTimeRemaining(challenge)
                const alreadyJoined = challenge.participants.includes(currentUserId)
                const isFull =
                  challenge.participants.length >= challenge.maxParticipants

                return (
                  <motion.div
                    key={challenge.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border space-y-3"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-bold">{challenge.title}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin size={12} />
                          <span>{venue?.name ?? challenge.sponsorVenueName}</span>
                        </div>
                      </div>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                        {challengeTypeLabel[challenge.challengeType] ?? challenge.challengeType}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground">
                      {challenge.description}
                    </p>

                    {/* Requirements */}
                    <div className="flex flex-wrap gap-2">
                      {challenge.requirements.visitVenue && (
                        <RequirementTag icon={<MapPin size={12} />} label="Visit venue" />
                      )}
                      {challenge.requirements.includePhoto && (
                        <RequirementTag icon={<Camera size={12} />} label="Photo required" />
                      )}
                      {challenge.requirements.minEnergyRating && (
                        <RequirementTag
                          icon={<Lightning size={12} />}
                          label={`Min: ${challenge.requirements.minEnergyRating}`}
                        />
                      )}
                      {challenge.requirements.useHashtag && (
                        <RequirementTag
                          icon={<HashStraight size={12} />}
                          label={challenge.requirements.useHashtag}
                        />
                      )}
                      {challenge.requirements.minGroupSize && (
                        <RequirementTag
                          icon={<Users size={12} />}
                          label={`${challenge.requirements.minGroupSize}+ people`}
                        />
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {timeLeft.days}d {timeLeft.hours}h
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {challenge.participants.length}/{challenge.maxParticipants}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs font-medium">
                          {rewardTypeIcon[challenge.reward.type]}
                          {challenge.reward.description}
                        </span>
                        {alreadyJoined ? (
                          <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg font-medium">
                            Joined
                          </span>
                        ) : (
                          <button
                            onClick={() => onJoinChallenge(challenge.id)}
                            disabled={isFull}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              isFull
                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                          >
                            {isFull ? 'Full' : 'Join'}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function RequirementTag({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-muted text-muted-foreground px-2 py-1 rounded-full">
      {icon}
      {label}
    </span>
  )
}
