'use client'

import { motion, type TargetAndTransition } from 'framer-motion'
import {
  MapPin,
  BellSimple,
  Star,
  Lightning,
  MagnifyingGlass,
  WifiSlash,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ComponentType, ReactNode } from 'react'

type EmptyStateVariant =
  | 'no-venues'
  | 'no-notifications'
  | 'no-favorites'
  | 'no-pulses'
  | 'no-results'
  | 'offline'

interface AnimatedEmptyStateProps {
  variant: EmptyStateVariant
  onAction?: () => void
  actionLabel?: string
  className?: string
}

interface VariantConfig {
  icon: ComponentType<{ size: number; weight: 'fill' | 'regular' | 'bold'; className?: string }>
  title: string
  description: string
  defaultActionLabel: string
  gradientFrom: string
  gradientTo: string
  iconAnimation: TargetAndTransition
}

const VARIANT_CONFIG: Record<EmptyStateVariant, VariantConfig> = {
  'no-venues': {
    icon: MapPin,
    title: 'No venues nearby',
    description: 'Try expanding your search or changing location',
    defaultActionLabel: 'Expand Search',
    gradientFrom: 'from-violet-500/20',
    gradientTo: 'to-indigo-500/20',
    iconAnimation: {
      y: [0, -8, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  },
  'no-notifications': {
    icon: BellSimple,
    title: 'All caught up!',
    description: "We'll let you know when something happens",
    defaultActionLabel: 'Go Explore',
    gradientFrom: 'from-amber-500/20',
    gradientTo: 'to-orange-500/20',
    iconAnimation: {
      rotate: [0, 12, -12, 8, -8, 0],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: 'easeInOut',
        repeatDelay: 1,
      },
    },
  },
  'no-favorites': {
    icon: Star,
    title: 'No favorites yet',
    description: 'Star venues to see them here',
    defaultActionLabel: 'Discover Venues',
    gradientFrom: 'from-yellow-500/20',
    gradientTo: 'to-amber-500/20',
    iconAnimation: {
      scale: [1, 1.15, 1, 1.1, 1],
      opacity: [1, 0.8, 1, 0.9, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  },
  'no-pulses': {
    icon: Lightning,
    title: 'No pulses yet',
    description: 'Be the first to drop a pulse!',
    defaultActionLabel: 'Drop a Pulse',
    gradientFrom: 'from-fuchsia-500/20',
    gradientTo: 'to-pink-500/20',
    iconAnimation: {
      opacity: [1, 0.3, 1, 0.5, 1],
      scale: [1, 1.1, 1, 1.05, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  },
  'no-results': {
    icon: MagnifyingGlass,
    title: 'Nothing found',
    description: 'Try different keywords',
    defaultActionLabel: 'Clear Search',
    gradientFrom: 'from-sky-500/20',
    gradientTo: 'to-cyan-500/20',
    iconAnimation: {
      scale: [1, 1.2, 1],
      rotate: [0, 15, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  },
  offline: {
    icon: WifiSlash,
    title: "You're offline",
    description: 'Check your connection',
    defaultActionLabel: 'Retry',
    gradientFrom: 'from-slate-500/20',
    gradientTo: 'to-gray-500/20',
    iconAnimation: {
      scale: [1, 1.05, 1],
      opacity: [1, 0.6, 1],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  },
}

const containerVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 20,
      staggerChildren: 0.1,
    },
  },
}

const childVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
}

export function AnimatedEmptyState({
  variant,
  onAction,
  actionLabel,
  className,
}: AnimatedEmptyStateProps): ReactNode {
  const config = VARIANT_CONFIG[variant]
  const IconComponent = config.icon

  return (
    <motion.div
      className={cn(
        'flex flex-col items-center justify-center px-8 py-16 text-center',
        className
      )}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Animated icon with gradient background */}
      <motion.div variants={childVariants} className="relative mb-6">
        <div
          className={cn(
            'flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br',
            config.gradientFrom,
            config.gradientTo
          )}
        >
          <motion.div animate={config.iconAnimation}>
            <IconComponent
              size={64}
              weight="fill"
              className="text-[var(--color-neutral-11)]"
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Title */}
      <motion.h3
        variants={childVariants}
        className="mb-2 text-xl font-semibold text-[var(--color-fg)]"
      >
        {config.title}
      </motion.h3>

      {/* Description */}
      <motion.p
        variants={childVariants}
        className="mb-6 max-w-[260px] text-sm text-[var(--color-fg-secondary)]"
      >
        {config.description}
      </motion.p>

      {/* Optional CTA button */}
      {onAction && (
        <motion.div variants={childVariants}>
          <Button onClick={onAction} variant="default" size="lg">
            {actionLabel ?? config.defaultActionLabel}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}
