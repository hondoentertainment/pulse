import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ScrollAwareHeaderProps {
  children: ReactNode
  isScrolled: boolean
  scrollDirection: 'up' | 'down' | null
  locationName?: string
  className?: string
}

const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

export function ScrollAwareHeader({
  children,
  isScrolled,
  scrollDirection: _scrollDirection,
  locationName,
  className,
}: ScrollAwareHeaderProps) {
  const isCompact = isScrolled

  return (
    <motion.div
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'flex items-center px-4',
        className
      )}
      animate={{
        height: isCompact ? 48 : 64,
      }}
      transition={springTransition}
      style={{ willChange: 'height' }}
    >
      {/* Backdrop layer */}
      <motion.div
        className="absolute inset-0 backdrop-blur-xl"
        animate={{
          backgroundColor: isScrolled
            ? 'hsl(var(--card) / 0.85)'
            : 'hsl(var(--card) / 0.4)',
        }}
        transition={{ duration: 0.2 }}
      />

      {/* Bottom border that fades in on scroll */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-border"
        animate={{ opacity: isScrolled ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Content */}
      <div className="relative z-10 flex w-full items-center justify-between">
        {children}

        {/* Location name - visible only when not compact */}
        {locationName && (
          <motion.span
            className="absolute left-1/2 text-sm font-medium text-muted-foreground truncate max-w-[200px]"
            animate={{
              opacity: isCompact ? 0 : 1,
              y: isCompact ? -8 : 0,
              x: '-50%',
            }}
            transition={springTransition}
            style={{ pointerEvents: isCompact ? 'none' : 'auto' }}
          >
            {locationName}
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}
