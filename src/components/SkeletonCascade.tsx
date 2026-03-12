import { type ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'

type SkeletonVariant = 'venue' | 'pulse' | 'notification'

interface SkeletonCascadeProps {
  count?: number
  variant?: SkeletonVariant
  className?: string
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
}

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted/50',
        className
      )}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, hsl(var(--muted)) 50%, transparent 100%)',
        }}
      />
    </div>
  )
}

function VenueSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3 space-y-3">
      {/* Image placeholder */}
      <ShimmerBlock className="w-full h-40 rounded-lg" />
      {/* Title */}
      <ShimmerBlock className="h-5 w-3/4" />
      {/* Category row */}
      <div className="flex items-center gap-2">
        <ShimmerBlock className="h-4 w-16 rounded-full" />
        <ShimmerBlock className="h-4 w-12 rounded-full" />
      </div>
      {/* Pulse score row */}
      <div className="flex items-center justify-between">
        <ShimmerBlock className="h-4 w-24" />
        <ShimmerBlock className="h-8 w-8 rounded-full" />
      </div>
    </div>
  )
}

function PulseSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      {/* User row */}
      <div className="flex items-center gap-3">
        <ShimmerBlock className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <ShimmerBlock className="h-4 w-28" />
          <ShimmerBlock className="h-3 w-16" />
        </div>
      </div>
      {/* Content lines */}
      <ShimmerBlock className="h-4 w-full" />
      <ShimmerBlock className="h-4 w-5/6" />
      {/* Action bar */}
      <div className="flex items-center gap-4 pt-1">
        <ShimmerBlock className="h-4 w-12" />
        <ShimmerBlock className="h-4 w-12" />
        <ShimmerBlock className="h-4 w-12" />
      </div>
    </div>
  )
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-4">
      {/* Icon placeholder */}
      <ShimmerBlock className="h-9 w-9 rounded-full shrink-0" />
      {/* Content */}
      <div className="flex-1 space-y-2">
        <ShimmerBlock className="h-4 w-4/5" />
        <ShimmerBlock className="h-3 w-2/5" />
      </div>
      {/* Timestamp */}
      <ShimmerBlock className="h-3 w-10 shrink-0" />
    </div>
  )
}

const variantMap: Record<SkeletonVariant, () => ReactNode> = {
  venue: VenueSkeleton,
  pulse: PulseSkeleton,
  notification: NotificationSkeleton,
}

export function SkeletonCascade({
  count = 5,
  variant = 'venue',
  className,
}: SkeletonCascadeProps) {
  const SkeletonComponent = variantMap[variant]

  return (
    <>
      {/* Inject shimmer keyframe once */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      <motion.div
        className={cn('space-y-3', className)}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {Array.from({ length: count }, (_, i) => (
          <motion.div key={i} variants={itemVariants}>
            <SkeletonComponent />
          </motion.div>
        ))}
      </motion.div>
    </>
  )
}
