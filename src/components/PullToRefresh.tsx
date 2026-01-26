import { useState, useRef, useCallback, ReactNode } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { ArrowClockwise } from '@phosphor-icons/react'

interface PullToRefreshProps {
    children: ReactNode
    onRefresh: () => Promise<void>
    threshold?: number
}

export function PullToRefresh({ children, onRefresh, threshold = 80 }: PullToRefreshProps) {
    const [isRefreshing, setIsRefreshing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const y = useMotionValue(0)
    const pullProgress = useTransform(y, [0, threshold], [0, 1])
    const rotate = useTransform(y, [0, threshold], [0, 180])

    const handleDragEnd = useCallback(async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y >= threshold && !isRefreshing) {
            setIsRefreshing(true)
            try {
                await onRefresh()
            } finally {
                setIsRefreshing(false)
            }
        }
    }, [threshold, isRefreshing, onRefresh])

    return (
        <div ref={containerRef} className="relative overflow-hidden">
            <motion.div
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10"
                style={{
                    y: useTransform(y, [0, threshold], [-40, 20]),
                    opacity: pullProgress
                }}
            >
                <motion.div
                    className={`w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}
                    style={{ rotate: isRefreshing ? undefined : rotate }}
                >
                    <ArrowClockwise size={20} className="text-accent" weight="bold" />
                </motion.div>
            </motion.div>

            <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.5, bottom: 0 }}
                onDragEnd={handleDragEnd}
                style={{ y }}
                className="touch-pan-y"
            >
                {children}
            </motion.div>
        </div>
    )
}
