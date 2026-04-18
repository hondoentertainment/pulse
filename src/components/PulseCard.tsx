import { PulseWithUser } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ENERGY_CONFIG } from '@/lib/types'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { getUserTrustBadges, TrustBadge } from '@/lib/credibility'
import { Fire, Eye, Skull, Lightning, Play, ArrowClockwise, Warning, Flag, ShareNetwork } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ReportDialog } from '@/components/ReportDialog'
import { ShareSheet } from '@/components/ShareSheet'
import type { ContentReport } from '@/lib/content-moderation'
import { getPulseDeepLink } from '@/lib/sharing'
import type { ShareCard } from '@/lib/sharing'
import { track } from '@/lib/observability/analytics'
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
  /** Feed surface this card is rendered in (for analytics). */
  feed?: string
  /** Zero-based position within the feed (for analytics). */
  position?: number
}

export function PulseCard({ pulse, allPulses = [], onReaction, onRetry, currentUserId, onReport, venueName, feed = 'unknown', position = 0 }: PulseCardProps) {
  const energyConfig = ENERGY_CONFIG[pulse.energyRating]
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCard, setShareCard] = useState<ShareCard | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const viewTrackedRef = useRef(false)

  const trustBadges = getUserTrustBadges(pulse.user, pulse.venueId, allPulses)

  const fireReaction = (type: 'fire' | 'eyes' | 'skull' | 'lightning') => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate([10])
    }
    track('reaction_added', { pulseId: pulse.id, reactionType: type })
    onReaction?.(type)
  }

  // Track `pulse_viewed` when the card is at least 50% visible for 500ms.
  useEffect(() => {
    const node = cardRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    if (viewTrackedRef.current) return

    let enteredAt: number | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (enteredAt === null) enteredAt = Date.now()
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
              if (viewTrackedRef.current) return
              viewTrackedRef.current = true
              track('pulse_viewed', {
                pulseId: pulse.id,
                feed,
                position,
                dwellMs: enteredAt ? Date.now() - enteredAt : 500,
              })
              observer.disconnect()
            }, 500)
          } else {
            enteredAt = null
            if (timer) {
              clearTimeout(timer)
              timer = null
            }
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    )

    observer.observe(node)
    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
    }
  }, [pulse.id, feed, position])

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "p-4 space-y-4 border-border relative",
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

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="w-10 h-10 border-2 border-border flex-shrink-0">
              <AvatarImage src={pulse.user.profilePhoto} />
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
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
                {formatTimeAgo(pulse.createdAt)}
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
            className="text-xs font-mono uppercase tracking-wider flex-shrink-0"
            style={{
              backgroundColor: energyConfig.color,
              color: 'white',
              borderColor: energyConfig.color
            }}
          >
            {energyConfig.emoji} {energyConfig.label}
          </Badge>
        </div>

        {pulse.video && (
          <div className="rounded-lg overflow-hidden bg-secondary aspect-video relative">
            <video
              src={pulse.video}
              controls
              className="w-full h-full object-cover"
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
            >
              Your browser does not support the video tag.
            </video>
            {!isVideoPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                  <Play size={32} weight="fill" className="text-black ml-1" />
                </div>
              </div>
            )}
          </div>
        )}

        {pulse.photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 rounded-lg overflow-hidden">
            {pulse.photos.slice(0, 4).map((photo, idx) => (
              <div
                key={idx}
                className={`aspect-square bg-secondary ${pulse.photos.length === 1 ? 'col-span-2' : ''
                  } ${pulse.photos.length === 3 && idx === 0 ? 'col-span-2' : ''}`}
              >
                <img
                  src={photo}
                  alt={`Pulse photo ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {pulse.caption && (
          <p className="text-sm leading-relaxed">{pulse.caption}</p>
        )}

        {pulse.hashtags && pulse.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pulse.hashtags.map((tag, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-xs font-mono"
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
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
              aria-label={`Fire reaction, ${pulse.reactions.fire.length}${currentUserId && pulse.reactions.fire.includes(currentUserId) ? ', you reacted' : ''}`}
              aria-pressed={!!currentUserId && pulse.reactions.fire.includes(currentUserId)}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                currentUserId && pulse.reactions.fire.includes(currentUserId)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={pulse.isPending || pulse.uploadError}
            >
              <Fire size={18} weight={currentUserId && pulse.reactions.fire.includes(currentUserId) ? "fill" : "regular"} />
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
              aria-label={`Lightning reaction, ${pulse.reactions.lightning.length}${currentUserId && pulse.reactions.lightning.includes(currentUserId) ? ', you reacted' : ''}`}
              aria-pressed={!!currentUserId && pulse.reactions.lightning.includes(currentUserId)}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                currentUserId && pulse.reactions.lightning.includes(currentUserId)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={pulse.isPending || pulse.uploadError}
            >
              <Lightning size={18} weight={currentUserId && pulse.reactions.lightning.includes(currentUserId) ? "fill" : "regular"} />
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
              aria-label={`Eyes reaction, ${pulse.reactions.eyes.length}${currentUserId && pulse.reactions.eyes.includes(currentUserId) ? ', you reacted' : ''}`}
              aria-pressed={!!currentUserId && pulse.reactions.eyes.includes(currentUserId)}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                currentUserId && pulse.reactions.eyes.includes(currentUserId)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={pulse.isPending || pulse.uploadError}
            >
              <Eye size={18} weight={currentUserId && pulse.reactions.eyes.includes(currentUserId) ? "fill" : "regular"} />
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
              aria-label={`Skull reaction, ${pulse.reactions.skull.length}${currentUserId && pulse.reactions.skull.includes(currentUserId) ? ', you reacted' : ''}`}
              aria-pressed={!!currentUserId && pulse.reactions.skull.includes(currentUserId)}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                currentUserId && pulse.reactions.skull.includes(currentUserId)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={pulse.isPending || pulse.uploadError}
            >
              <Skull size={18} weight={currentUserId && pulse.reactions.skull.includes(currentUserId) ? "fill" : "regular"} />
              <span className="text-sm font-mono">{pulse.reactions.skull.length}</span>
            </motion.button>
          </div>

          <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Eye size={14} />
              <span>{pulse.views}</span>
            </div>
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
              className="text-muted-foreground hover:text-accent transition-colors"
              title="Share"
              aria-label="Share pulse"
            >
              <ShareNetwork size={16} />
            </button>
            {currentUserId && currentUserId !== pulse.user.id && (
              <button
                onClick={() => setShowReport(true)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Report"
                aria-label="Report pulse"
              >
                <Flag size={16} />
              </button>
            )}
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
}

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
