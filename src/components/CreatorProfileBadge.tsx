import type { CreatorTier } from '@/lib/creator-economy'
import { CheckCircle, Star, Lightning } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface CreatorProfileBadgeProps {
  tier: CreatorTier
  size?: 'xs' | 'sm' | 'md'
  showLabel?: boolean
  onClick?: () => void
}

const TIER_CONFIG: Record<
  CreatorTier,
  {
    label: string
    bgColor: string
    textColor: string
    borderColor: string
    glowColor: string
  }
> = {
  rising: {
    label: 'Rising',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    glowColor: 'shadow-blue-500/20',
  },
  verified: {
    label: 'Verified',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    glowColor: 'shadow-purple-500/20',
  },
  elite: {
    label: 'Elite',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    glowColor: 'shadow-yellow-500/20',
  },
}

function TierIcon({ tier, size }: { tier: CreatorTier; size: number }) {
  switch (tier) {
    case 'rising':
      return <Lightning size={size} weight="fill" />
    case 'verified':
      return <CheckCircle size={size} weight="fill" />
    case 'elite':
      return <Star size={size} weight="fill" />
  }
}

export function CreatorProfileBadge({
  tier,
  size = 'sm',
  showLabel = true,
  onClick,
}: CreatorProfileBadgeProps) {
  const config = TIER_CONFIG[tier]

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
  }

  const iconSizes = { xs: 10, sm: 12, md: 16 }

  const Component = onClick ? motion.button : motion.span

  return (
    <Component
      onClick={onClick}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      className={`
        inline-flex items-center rounded-full font-medium
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        border shadow-sm ${config.glowColor}
        ${sizeClasses[size]}
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
      `}
    >
      <TierIcon tier={tier} size={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
    </Component>
  )
}
