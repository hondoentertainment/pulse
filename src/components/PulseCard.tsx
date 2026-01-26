import { PulseWithUser } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ENERGY_CONFIG } from '@/lib/types'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { getUserTrustBadges, TrustBadge } from '@/lib/credibility'
import { Fire, Eye, Skull, Lightning, Play, ArrowClockwise, Warning } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { cn } from '@/lib/utils'
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
}

export function PulseCard({ pulse, allPulses = [], onReaction, onRetry, currentUserId }: PulseCardProps) {
  const energyConfig = ENERGY_CONFIG[pulse.energyRating]
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  const trustBadges = getUserTrustBadges(pulse.user, pulse.venueId, allPulses)

  return (
    <motion.div
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
              <p className="font-semibold truncate">{pulse.user.username}</p>
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
            <button
              onClick={() => onReaction?.('fire')}
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
            </button>
            <button
              onClick={() => onReaction?.('lightning')}
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
            </button>
            <button
              onClick={() => onReaction?.('eyes')}
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
            </button>
            <button
              onClick={() => onReaction?.('skull')}
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
            </button>
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
          </div>
        </div>
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
