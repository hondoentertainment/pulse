import { Check, Star } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface VerifiedBadgeProps {
  tier: 'creator' | 'verified' | 'elite'
  className?: string
}

/**
 * Small inline badge. Nothing renders for the base 'creator' tier.
 */
export function VerifiedBadge({ tier, className }: VerifiedBadgeProps) {
  if (tier === 'creator') return null
  const isElite = tier === 'elite'
  return (
    <span
      aria-label={isElite ? 'Elite creator' : 'Verified creator'}
      className={cn(
        'inline-flex items-center justify-center rounded-full w-4 h-4 flex-shrink-0',
        isElite ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/20 text-primary',
        className
      )}
    >
      {isElite ? (
        <Star size={10} weight="fill" />
      ) : (
        <Check size={10} weight="bold" />
      )}
    </span>
  )
}
