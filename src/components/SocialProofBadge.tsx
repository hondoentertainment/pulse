import { motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users, Star, TrendUp } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { SocialProof } from '@/lib/social-coordination'

interface SocialProofBadgeProps {
  proof: SocialProof
  avatars?: string[]
}

export function SocialProofBadge({ proof, avatars = [] }: SocialProofBadgeProps) {
  if (!proof.label) return null

  const Icon = proof.isFavoriteInCircle
    ? Star
    : proof.trendingInCircle
      ? TrendUp
      : Users

  const iconColor = proof.isFavoriteInCircle
    ? 'text-pink-400'
    : proof.trendingInCircle
      ? 'text-purple-400'
      : 'text-purple-300'

  const bgColor = proof.isFavoriteInCircle
    ? 'bg-pink-500/10 border-pink-500/20'
    : proof.trendingInCircle
      ? 'bg-purple-500/10 border-purple-500/20'
      : 'bg-purple-500/8 border-purple-400/15'

  const displayAvatars = avatars.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        bgColor
      )}
    >
      {/* Avatar stack */}
      {displayAvatars.length > 0 && (
        <div className="flex -space-x-1.5">
          {displayAvatars.map((src, i) => (
            <Avatar
              key={i}
              className="h-4 w-4 border border-card"
            >
              <AvatarImage src={src} />
              <AvatarFallback className="bg-muted text-[6px]" />
            </Avatar>
          ))}
        </div>
      )}

      {/* Icon with subtle pulse animation for trending */}
      {proof.trendingInCircle ? (
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon size={12} weight="fill" className={iconColor} />
        </motion.div>
      ) : (
        <Icon
          size={12}
          weight={proof.isFavoriteInCircle ? 'fill' : 'bold'}
          className={iconColor}
        />
      )}

      {/* Label */}
      <span className="text-[10px] font-medium text-foreground/80 whitespace-nowrap">
        {proof.label}
      </span>
    </motion.div>
  )
}
