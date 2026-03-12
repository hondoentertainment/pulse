'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type TransitionDirection = 'left' | 'right' | 'up' | 'down'

interface DirectionalPageTransitionProps {
  children: ReactNode
  direction?: TransitionDirection
  className?: string
}

interface AxisOffset {
  x?: number
  y?: number
}

function getDirectionOffset(direction: TransitionDirection): AxisOffset {
  switch (direction) {
    case 'left':
      return { x: -60 }
    case 'right':
      return { x: 60 }
    case 'up':
      return { y: -60 }
    case 'down':
      return { y: 60 }
  }
}

const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
}

function buildVariants(direction: TransitionDirection) {
  const offset = getDirectionOffset(direction)

  return {
    initial: {
      opacity: 0,
      x: offset.x ?? 0,
      y: offset.y ?? 0,
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: springTransition,
    },
    exit: {
      opacity: 0,
      x: offset.x !== undefined ? -offset.x : 0,
      y: offset.y !== undefined ? -offset.y : 0,
      transition: {
        duration: 0.2,
      },
    },
  }
}

export function DirectionalPageTransition({
  children,
  direction = 'right',
  className,
}: DirectionalPageTransitionProps): ReactNode {
  const variants = buildVariants(direction)

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={direction}
        className={cn('will-change-transform', className)}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ overflowAnchor: 'none' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
