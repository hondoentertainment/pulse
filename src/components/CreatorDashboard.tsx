import { useMemo, useState } from 'react'
import { User, Pulse, Venue } from '@/lib/types'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { CreatorEconomyTab } from '@/components/creator/CreatorEconomyTab'
import {
  TipJar,
  getCreatorStats,
  getCreatorTierProgress,
  CREATOR_TIER_REQUIREMENTS,
  Attribution,
} from '@/lib/creator-economy'
import {
  VenueChallenge,
  getUserActiveChallenges,
  getChallengeTimeRemaining,
} from '@/lib/venue-challenges'
import {
  Partnership,
  getCreatorProposals,
  getActivePartnerships,
} from '@/lib/brand-partnerships'
import { CreatorProfileBadge } from '@/components/CreatorProfileBadge'
import { PayoutOnboarding } from '@/components/ticketing/PayoutOnboarding'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  CaretLeft,
  ChartBar,
  CurrencyDollar,
  Lightning,
  Eye,
  Users,
  Trophy,
  Handshake,
  ArrowDown,
  Check,
  X,
  Clock,
  Star,
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface CreatorDashboardProps {
  currentUser: User
  pulses: Pulse[]
  venues: Venue[]
  attributions: Attribution[]
  tipJar: TipJar | null
  challenges: VenueChallenge[]
  partnerships: Partnership[]
  onBack: () => void
  onAcceptPartnership: (partnershipId: string) => void
  onDeclinePartnership: (partnershipId: string) => void
  onWithdrawTips: () => void
}

export function CreatorDashboard({
  currentUser,
  pulses,
  venues,
  attributions,
  tipJar,
  challenges,
  partnerships,
  onBack,
  onAcceptPartnership,
  onDeclinePartnership,
  onWithdrawTips,
}: CreatorDashboardProps) {
  const userPulses = useMemo(
    () => pulses.filter(p => p.userId === currentUser.id),
    [pulses, currentUser.id]
  )

  const totalReactions = useMemo(
    () =>
      userPulses.reduce(
        (sum, p) =>
          sum +
          p.reactions.fire.length +
          p.reactions.eyes.length +
          p.reactions.skull.length +
          p.reactions.lightning.length,
        0
      ),
    [userPulses]
  )

  const stats = useMemo(
    () => getCreatorStats(currentUser.id, userPulses, attributions),
    [currentUser.id, userPulses, attributions]
  )

  const tierProgress = useMemo(
    () => getCreatorTierProgress(userPulses.length, totalReactions, currentUser.friends.length),
    [userPulses.length, totalReactions, currentUser.friends.length]
  )

  const activeChallenges = useMemo(
    () => getUserActiveChallenges(challenges, currentUser.id),
    [challenges, currentUser.id]
  )

  const proposals = useMemo(
    () => getCreatorProposals(partnerships, currentUser.id),
    [partnerships, currentUser.id]
  )

  const activePartnerships = useMemo(
    () => getActivePartnerships(partnerships, currentUser.id),
    [partnerships, currentUser.id]
  )

  const totalEarnings =
    (tipJar?.totalTips ?? 0) +
    partnerships
      .filter(p => p.creatorId === currentUser.id && p.status === 'completed')
      .reduce((sum, p) => sum + p.compensation, 0)

  const tierLabel = tierProgress.currentTier
    ? tierProgress.currentTier.charAt(0).toUpperCase() + tierProgress.currentTier.slice(1)
    : 'Aspiring'

  const creatorEconomyEnabled = isFeatureEnabled('creatorEconomy')
  const [activeTab, setActiveTab] = useState<'overview' | 'creator'>('overview')

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <CaretLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Star size={24} weight="fill" className="text-accent" />
            <h1 className="text-xl font-bold">Creator Dashboard</h1>
          </div>
          {tierProgress.currentTier && (
            <div className="ml-auto">
              <CreatorProfileBadge tier={tierProgress.currentTier} size="sm" />
            </div>
          )}
        </div>
      </div>

      {creatorEconomyEnabled && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex gap-2 border-b border-border">
            <button
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
              onClick={() => setActiveTab('overview')}
              aria-pressed={activeTab === 'overview'}
            >
              Overview
            </button>
            <button
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'creator' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
              onClick={() => setActiveTab('creator')}
              aria-pressed={activeTab === 'creator'}
            >
              Creator
            </button>
          </div>
        </div>
      )}

      {creatorEconomyEnabled && activeTab === 'creator' && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <CreatorEconomyTab userId={currentUser.id} />
        </div>
      )}

      <div
        className="max-w-2xl mx-auto px-4 py-6 space-y-6"
        style={creatorEconomyEnabled && activeTab !== 'overview' ? { display: 'none' } : undefined}
      >
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Eye size={18} weight="fill" />}
            label="Total Reach"
            value={formatNumber(stats.reach)}
            color="text-blue-400"
          />
          <StatCard
            icon={<Lightning size={18} weight="fill" />}
            label="Engagement"
            value={`${stats.engagementRate}%`}
            color="text-yellow-400"
          />
          <StatCard
            icon={<Users size={18} weight="fill" />}
            label="Attributed Visits"
            value={stats.attributedVenueVisits.toString()}
            color="text-green-400"
          />
          <StatCard
            icon={<CurrencyDollar size={18} weight="fill" />}
            label="Total Earnings"
            value={`$${totalEarnings.toFixed(2)}`}
            color="text-purple-400"
          />
        </div>

        {/* Payouts (ticketing flag only) */}
        {isFeatureEnabled('ticketing') && (
          <PayoutOnboarding venueId={venues[0]?.id ?? null} />
        )}

        {/* Tier Progress */}
        <div className="bg-card rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Creator Tier</h3>
            <span className="text-sm font-medium text-primary">{tierLabel}</span>
          </div>

          {tierProgress.nextTier && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress to {tierProgress.nextTier.charAt(0).toUpperCase() + tierProgress.nextTier.slice(1)}</span>
                  <span>{tierProgress.progress}%</span>
                </div>
                <Progress value={tierProgress.progress} />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pulses</span>
                    <span>{tierProgress.pulsesProgress}%</span>
                  </div>
                  <Progress value={tierProgress.pulsesProgress} className="h-1" />
                  <p className="text-muted-foreground">
                    {userPulses.length}/{CREATOR_TIER_REQUIREMENTS[tierProgress.nextTier].minPulses}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Reactions</span>
                    <span>{tierProgress.reactionsProgress}%</span>
                  </div>
                  <Progress value={tierProgress.reactionsProgress} className="h-1" />
                  <p className="text-muted-foreground">
                    {totalReactions}/{CREATOR_TIER_REQUIREMENTS[tierProgress.nextTier].minReactions}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Followers</span>
                    <span>{tierProgress.followersProgress}%</span>
                  </div>
                  <Progress value={tierProgress.followersProgress} className="h-1" />
                  <p className="text-muted-foreground">
                    {currentUser.friends.length}/{CREATOR_TIER_REQUIREMENTS[tierProgress.nextTier].minFollowers || 0}
                  </p>
                </div>
              </div>
            </>
          )}

          {!tierProgress.nextTier && tierProgress.currentTier === 'elite' && (
            <p className="text-sm text-muted-foreground">
              You have reached the highest creator tier!
            </p>
          )}
        </div>

        {/* Earnings Breakdown */}
        <div className="bg-card rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center gap-2">
            <CurrencyDollar size={20} weight="fill" className="text-green-400" />
            <h3 className="font-bold">Earnings Breakdown</h3>
          </div>
          <div className="space-y-2">
            <EarningsRow label="Tips" amount={tipJar?.totalTips ?? 0} />
            <EarningsRow
              label="Sponsorships"
              amount={partnerships
                .filter(p => p.creatorId === currentUser.id && p.status === 'completed')
                .reduce((sum, p) => sum + p.compensation, 0)}
            />
            <EarningsRow label="Challenges" amount={0} />
            <Separator />
            <EarningsRow label="Total" amount={totalEarnings} bold />
          </div>
          {(tipJar?.withdrawable ?? 0) > 0 && (
            <button
              onClick={onWithdrawTips}
              className="w-full mt-2 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-500/30 transition-colors"
            >
              <ArrowDown size={16} weight="bold" />
              Withdraw ${tipJar!.withdrawable.toFixed(2)}
            </button>
          )}
        </div>

        {/* Top Performing Pulses */}
        {stats.topPerformingPulses.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ChartBar size={20} weight="fill" className="text-primary" />
              <h3 className="font-bold">Top Performing Pulses</h3>
            </div>
            <div className="space-y-2">
              {stats.topPerformingPulses.map((tp, i) => {
                const venue = venues.find(v => v.id === tp.venueId)
                return (
                  <motion.div
                    key={tp.pulseId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-lg p-3 border border-border flex items-center gap-3"
                  >
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {venue?.name ?? 'Unknown venue'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tp.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{tp.reactions}</p>
                      <p className="text-xs text-muted-foreground">{tp.views} views</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        <Separator />

        {/* Active Challenges */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy size={20} weight="fill" className="text-yellow-400" />
            <h3 className="font-bold">Active Challenges</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {activeChallenges.length} active
            </span>
          </div>
          {activeChallenges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active challenges. Browse the challenge feed to find some!
            </p>
          ) : (
            activeChallenges.map(challenge => {
              const venue = venues.find(v => v.id === challenge.venueId)
              const timeLeft = getChallengeTimeRemaining(challenge)
              return (
                <div
                  key={challenge.id}
                  className="bg-card rounded-xl p-4 border border-border space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{challenge.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {venue?.name ?? challenge.sponsorVenueName}
                      </p>
                    </div>
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                      {challenge.reward.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock size={14} />
                    {timeLeft.expired
                      ? 'Expired'
                      : `${timeLeft.days}d ${timeLeft.hours}h left`}
                    <span className="ml-auto">
                      {challenge.participants.length}/{challenge.maxParticipants} participants
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <Separator />

        {/* Partnership Proposals */}
        {proposals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Handshake size={20} weight="fill" className="text-blue-400" />
              <h3 className="font-bold">Partnership Proposals</h3>
              <span className="ml-auto bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">
                {proposals.length} new
              </span>
            </div>
            {proposals.map(proposal => (
              <div
                key={proposal.id}
                className="bg-card rounded-xl p-4 border border-border space-y-3"
              >
                <div>
                  <p className="font-medium text-sm">{proposal.venueName}</p>
                  <p className="text-xs text-muted-foreground">
                    {proposal.type === 'recurring' ? 'Recurring' : 'One-time'} partnership
                  </p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    {proposal.deliverables.pulseCount} pulses, {proposal.deliverables.storyCount} stories
                  </p>
                  <p className="font-medium text-green-400">
                    ${proposal.compensation} compensation
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptPartnership(proposal.id)}
                    className="flex-1 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium flex items-center justify-center gap-1 hover:bg-green-500/30 transition-colors"
                  >
                    <Check size={16} weight="bold" /> Accept
                  </button>
                  <button
                    onClick={() => onDeclinePartnership(proposal.id)}
                    className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium flex items-center justify-center gap-1 hover:bg-red-500/30 transition-colors"
                  >
                    <X size={16} weight="bold" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Partnerships */}
        {activePartnerships.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Handshake size={20} weight="fill" className="text-green-400" />
              <h3 className="font-bold">Active Partnerships</h3>
            </div>
            {activePartnerships.map(p => (
              <div
                key={p.id}
                className="bg-card rounded-xl p-4 border border-border space-y-2"
              >
                <div className="flex justify-between">
                  <p className="font-medium text-sm">{p.venueName}</p>
                  <span className="text-xs text-green-400 font-medium">
                    ${p.compensation}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>
                    Pulses: {p.completedDeliverables.pulsesPosted}/{p.deliverables.pulseCount} |
                    Stories: {p.completedDeliverables.storiesPosted}/{p.deliverables.storyCount}
                  </p>
                </div>
                <Progress
                  value={
                    ((p.completedDeliverables.pulsesPosted + p.completedDeliverables.storiesPosted) /
                      (p.deliverables.pulseCount + p.deliverables.storyCount)) *
                    100
                  }
                  className="h-1.5"
                />
              </div>
            ))}
          </div>
        )}

        {/* Tip History */}
        {tipJar && tipJar.tipHistory.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={20} weight="fill" className="text-green-400" />
                <h3 className="font-bold">Tip History</h3>
              </div>
              <div className="space-y-2">
                {tipJar.tipHistory.slice(0, 10).map(tip => (
                  <div
                    key={tip.id}
                    className="bg-card rounded-lg p-3 border border-border flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CurrencyDollar size={16} weight="bold" className="text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">${tip.amount.toFixed(2)} tip</p>
                      {tip.message && (
                        <p className="text-xs text-muted-foreground truncate">{tip.message}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-green-400">+${tip.netAmount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tip.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl p-4 border border-border"
    >
      <div className={`mb-2 ${color}`}>{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </motion.div>
  )
}

function EarningsRow({
  label,
  amount,
  bold,
}: {
  label: string
  amount: number
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold' : ''}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className={bold ? 'text-green-400' : ''}>${amount.toFixed(2)}</span>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}
