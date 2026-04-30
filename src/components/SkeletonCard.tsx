import { motion } from 'framer-motion'

export function VenueCardSkeleton() {
    return (
        <div className="p-4 rounded-2xl border border-border bg-card animate-pulse">
            <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-muted/50" />
                <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted/50 rounded w-3/4" />
                    <div className="h-3 bg-muted/30 rounded w-1/2" />
                    <div className="h-3 bg-muted/30 rounded w-1/3" />
                </div>
                <div className="w-12 h-12 rounded-full bg-muted/50" />
            </div>
        </div>
    )
}

export function PulseCardSkeleton() {
    return (
        <div className="p-4 rounded-2xl border border-border bg-card animate-pulse">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-muted/50" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted/50 rounded w-1/3" />
                    <div className="h-3 bg-muted/30 rounded w-1/4" />
                </div>
            </div>
            <div className="h-40 bg-muted/30 rounded-xl mb-3" />
            <div className="space-y-2">
                <div className="h-4 bg-muted/40 rounded w-full" />
                <div className="h-4 bg-muted/30 rounded w-2/3" />
            </div>
            <div className="flex gap-2 mt-4">
                <div className="h-8 w-16 bg-muted/30 rounded-full" />
                <div className="h-8 w-16 bg-muted/30 rounded-full" />
                <div className="h-8 w-16 bg-muted/30 rounded-full" />
            </div>
        </div>
    )
}

export function NotificationCardSkeleton() {
    return (
        <div className="p-4 rounded-xl border border-border bg-card animate-pulse">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted/50" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted/50 rounded w-3/4" />
                    <div className="h-3 bg-muted/30 rounded w-1/2" />
                </div>
            </div>
        </div>
    )
}

interface SkeletonListProps {
    count?: number
    type: 'venue' | 'pulse' | 'notification'
}

export function SkeletonList({ count = 3, type }: SkeletonListProps) {
    const SkeletonComponent = {
        venue: VenueCardSkeleton,
        pulse: PulseCardSkeleton,
        notification: NotificationCardSkeleton
    }[type]

    return (
        <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {Array.from({ length: count }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                >
                    <SkeletonComponent />
                </motion.div>
            ))}
        </motion.div>
    )
}
