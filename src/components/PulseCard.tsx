import { PulseWithUser } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ENERGY_CONFIG } from '@/lib/types'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { Fire, Eye, Skull, Lightning, Play } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useState } from 'react'

interface PulseCardProps {
  pulse: PulseWithUser
  onReaction?: (type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
}

export function PulseCard({ pulse, onReaction }: PulseCardProps) {
  const energyConfig = ENERGY_CONFIG[pulse.energyRating]
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-4 space-y-4 border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-border">
              <AvatarImage src={pulse.user.profilePhoto} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {pulse.user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{pulse.user.username}</p>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
                {formatTimeAgo(pulse.createdAt)}
              </p>
            </div>
          </div>

          <Badge
            className="text-xs font-mono uppercase tracking-wider"
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
                className={`aspect-square bg-secondary ${
                  pulse.photos.length === 1 ? 'col-span-2' : ''
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

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onReaction?.('fire')}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Fire size={18} weight="fill" />
              <span className="text-sm font-mono">{pulse.reactions.fire || 0}</span>
            </button>
            <button
              onClick={() => onReaction?.('lightning')}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Lightning size={18} weight="fill" />
              <span className="text-sm font-mono">{pulse.reactions.lightning || 0}</span>
            </button>
            <button
              onClick={() => onReaction?.('eyes')}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye size={18} weight="fill" />
              <span className="text-sm font-mono">{pulse.reactions.eyes || 0}</span>
            </button>
            <button
              onClick={() => onReaction?.('skull')}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Skull size={18} weight="fill" />
              <span className="text-sm font-mono">{pulse.reactions.skull || 0}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Eye size={14} />
            <span>{pulse.views}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
