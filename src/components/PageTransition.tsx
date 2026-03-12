import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PageTransitionProps {
  children: ReactNode
  pageKey: string
  direction?: 'forward' | 'back' | 'up' | 'fade'
}

const variants = {
  forward: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-30%', opacity: 0 },
  },
  back: {
    initial: { x: '-30%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
  },
  up: {
    initial: { y: '100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 },
  },
  fade: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
  },
}

const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

export function PageTransition({ children, pageKey, direction = 'fade' }: PageTransitionProps) {
  const v = variants[direction]

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={v.initial}
        animate={v.animate}
        exit={v.exit}
        transition={springTransition}
        className="min-h-screen"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Wrap tab content for cross-fade transitions between tabs */
interface TabTransitionProps {
  children: ReactNode
  tabKey: string
}

export function TabTransition({ children, tabKey }: TabTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Shared element transition wrapper — use matching layoutId across pages */
interface SharedElementProps {
  children: ReactNode
  layoutId: string
  className?: string
}

export function SharedElement({ children, layoutId, className }: SharedElementProps) {
  return (
    <motion.div layoutId={layoutId} className={className} transition={springTransition}>
      {children}
    </motion.div>
  )
}

/** Staggered list animation for venue cards, pulse feeds, etc. */
interface StaggeredListProps {
  children: ReactNode[]
  staggerDelay?: number
  className?: string
}

export function StaggeredList({ children, staggerDelay = 0.05, className }: StaggeredListProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: i * staggerDelay,
            duration: 0.3,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}

/** Smooth scale-in for modals and overlays */
interface OverlayTransitionProps {
  children: ReactNode
  isOpen: boolean
  onClose?: () => void
}

export function OverlayTransition({ children, isOpen, onClose }: OverlayTransitionProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-[91] flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
