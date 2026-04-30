import { PulseWithUser } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PulseMediaCarousel } from '@/components/PulseMediaCarousel'
import { ENERGY_CONFIG } from '@/lib/types'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { getUserTrustBadges, TrustBadge } from '@/lib/credibility'
import { Fire, Eye, Skull, Lightning, ArrowClockwise, Warning, Flag, ShareNetwork } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { memo, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ReportDialog } from '@/components/ReportDialog'
import { ShareSheet } from '@/components/ShareSheet'
import type { ContentReport } from '@/lib/content-moderation'
import { getPulseDeepLink } from '@/lib/sharing'
import type { ShareCard } from '@/lib/sharing'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PulseCardProps {
  pulse: PulseWithUser
  allPulses?: PulseWithUser[]
  onReaction?: (type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
  onRetry?: () => void
  currentUserId?: string
  onReport?: (report: ContentReport) => void
  venueName?: string
}

export const PulseCard = memo(function PulseCard({ pulse, allPulses = [], onReaction, onRetry, currentUserId, onReport, venueName }: PulseCardProps) {
  const energyConfig = ENERGY_CONFIG[pulse.energyRating]
  const [showReport, setShowReport] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCard, setShareCard] = useState<ShareCard | null>(null)
  const [reactionBurst, setReactionBurst] = useState<string | null>(null)

  const trustBadges = useMemo(
    () => getUserTrustBadges(pulse.user, pulse.venueId, allPulses),
    [allPulses, pulse.user, pulse.venueId]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "relative overflow-hidden border-border/70 bg-card/95 p-0 shadow-lg shadow-black/10",
        pulse.isPending && "border-accent/50",
        pulse.uploadError && "border-destructive/50"
      )}>
        {pulse.isPending && !pulse.uploadError && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-accent/20 text-accent border-accent/30 animate-pulse-glow">
              <span className="font-mono text-xs uppercase tracking-wider">Sending…</span>
            </Badge>
          </div>
        )}

        {pulse.uploadError && (
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <Badge className="bg-destructive/20 text-destructive border-destructive/30">
              <Warning size={14} weight="fill" className="mr-1" />
              <span className="font-mono text-xs uppercase tracking-wider">Failed</span>
            </Badge>
          </div>
        )}

        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-11 w-11 flex-shrink-0 border-2 border-accent/40">
              <AvatarImage src={pulse.user.profilePhoto} loading="lazy" decoding="async" />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {pulse.user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold truncate">{pulse.user.username}</p>
                {pulse.user.postStreak && pulse.user.postStreak >= 2 && (
                  <Badge className="bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 border-orange-500/30 text-[10px] px-1.5 py-0 h-4">
                    🔥 {pulse.user.postStreak} Day Streak
                  </Badge>
                )}
                {pulse.isPioneer && (
                  <Badge className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border-yellow-500/30 text-[10px] px-1.5 py-0 h-4">
                    🧗 Pioneer
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {venueName ? `${venueName} · ` : ''}{formatTimeAgo(pulse.createdAt)}
              </p>
              {trustBadges.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {trustBadges.map((badge) => (
                    <TrustBadgeComponent key={badge.id} badge={badge} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <Badge
            className="flex-shrink-0 text-xs font-semibold"
            style={{
              backgroundColor: energyConfig.color,
              color: 'white',
              borderColor: energyConfig.color
            }}
          >
            {energyConfig.emoji} {energyConfig.label}
          </Badge>
        </div>

        <div className="relative">
          <PulseMediaCarousel
            photos={pulse.photos}
            video={pulse.video}
            altPrefix={`${pulse.user.username} pulse`}
            onDoubleTap={() => {
              setReactionBurst('fire')
              window.setTimeout(() => setReactionBurst(null), 650)
              onReaction?.('fire')
            }}
          />
          {reactionBurst && (
            <motion.div
              key={reactionBurst}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1.25 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl drop-shadow-2xl"
            >
              🔥
            </motion.div>
          )}
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <motion.button
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => {
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate([10])
                }
                onReaction?.('fire')
              }}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full transition-colors",
                currentUserId && pulse.reactions.fire.includes(currentUserId)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={pulse.isPending || pulse.uploadError}
              aria-label={`React with fire. ${pulse.reactions.fire.length} reactions`}
            >
              <Fire size={24} weight={currentUserId && pulse.reactions.fire.includes(currentUserId) ? "fill" : "regular"} />
              <span className="text-sm font-mono">{pulse.reactions.fire.length}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => {
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate([10])
                }
                onReaction?.('lightning')
              }}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full transition-colors",
                currentUserId && pulse.reactions.lightning.includes(currentUserId)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={pulse.isPending || pulse.uploadError}
              aria-label={`React with lightning. ${pulse.reactions.lightning.length} reactions`}
            >
              <Lightning size={24} weight={currentUserId && pulse.reactions.lightning.includes(currentUserId) ? "fill" : "regular"} />
              <span className="text-sm font-mono">{pulse.reactions.lightning.length}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => {
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate([10])
                }
                onReaction?.('eyes')
              }}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full transition-colors",
                currentUserId && pulse.reactions.eyes.includes(currentUserId)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={pulse.isPending || pulse.uploadError}
              aria-label={`React with eyes. ${pulse.reactions.eyes.length} reactions`}
            >
              <Eye size={24} weight={currentUserId && pulse.reactions.eyes.includes(currentUserId) ? "fill" : "regular"} />
              <span className="text-sm font-mono">{pulse.reactions.eyes.length}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => {
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate([10])
                }
                onReaction?.('skull')
              }}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full transition-colors",
                currentUserId && pulse.reactions.skull.includes(currentUserId)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={pulse.isPending || pulse.uploadError}
              aria-label={`React with skull. ${pulse.reactions.skull.length} reactions`}
            >
              <Skull size={24} weight={currentUserId && pulse.reactions.skull.includes(currentUserId) ? "fill" : "regular"} />
              <span className="text-sm font-mono">{pulse.reactions.skull.length}</span>
            </motion.button>
            </div>

            <div className="flex items-center gap-3">
            {pulse.uploadError && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-7 px-2 border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <ArrowClockwise size={14} className="mr-1" />
                Retry
              </Button>
            )}
            <button
              onClick={() => {
                const card: ShareCard = {
                  title: `${pulse.user.username} at ${venueName ?? 'a venue'}`,
                  description: pulse.caption ?? `${energyConfig.label} energy right now`,
                  imageText: `${venueName ?? 'Venue'}\n${pulse.energyRating.toUpperCase()}`,
                  energyLabel: energyConfig.label,
                  energyColor: energyConfig.color,
                  score: 0,
                  url: getPulseDeepLink(pulse.id),
                }
                setShareCard(card)
                setShareOpen(true)
              }}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-accent"
              aria-label="Share pulse"
              title="Share"
            >
              <ShareNetwork size={22} />
            </button>
            {currentUserId && currentUserId !== pulse.user.id && (
              <button
                onClick={() => setShowReport(true)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                aria-label="Report pulse"
                title="Report"
              >
                <Flag size={20} />
              </button>
            )}
            </div>
          </div>

          {pulse.caption && (
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">{pulse.user.username}</span>{' '}
              {pulse.caption}
            </p>
          )}

          {pulse.hashtags && pulse.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pulse.hashtags.map((tag, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="rounded-full text-xs"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/60 pt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye size={14} />
              <span>{pulse.views} views</span>
            </div>
            <span className="text-xs text-muted-foreground">{formatTimeAgo(pulse.createdAt)}</span>
          </div>
        </div>

        {currentUserId && (
          <ReportDialog
            open={showReport}
            onOpenChange={setShowReport}
            targetType="pulse"
            targetId={pulse.id}
            reporterId={currentUserId}
            onReport={(report) => {
              onReport?.(report)
            }}
          />
        )}

        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          card={shareCard}
        />
      </Card>
    </motion.div>
  )
})

function TrustBadgeComponent({ badge }: { badge: TrustBadge }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Badge
            className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 cursor-help"
            style={{
              backgroundColor: `${badge.color}20`,
              color: badge.color,
              borderColor: `${badge.color}40`
            }}
          >
            <span className="mr-1">{badge.icon}</span>
            {badge.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{badge.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
