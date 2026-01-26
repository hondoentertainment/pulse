import { motion } from 'framer-motion'
import { Fire, Confetti } from '@phosphor-icons/react'

interface StreakBadgeProps {
    streak: number
    showAnimation?: boolean
}

export function StreakBadge({ streak, showAnimation = false }: StreakBadgeProps) {
    if (streak < 1) return null

    return (
        <motion.div
            initial={showAnimation ? { scale: 0, rotate: -180 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30"
        >
            <motion.div
                animate={showAnimation ? {
                    scale: [1, 1.3, 1],
                    rotate: [0, -10, 10, 0]
                } : {}}
                transition={{ duration: 0.5, delay: 0.3 }}
            >
                <Fire size={16} weight="fill" className="text-orange-500" />
            </motion.div>
            <span className="text-sm font-bold text-orange-500">{streak}</span>
            <span className="text-xs text-orange-400/80 font-mono uppercase">day streak</span>
        </motion.div>
    )
}

interface FirstPulseCelebrationProps {
    venueName: string
    onComplete?: () => void
}

export function FirstPulseCelebration({ venueName, onComplete }: FirstPulseCelebrationProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onAnimationComplete={onComplete}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
            <motion.div
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                className="text-center p-8"
            >
                <motion.div
                    animate={{
                        rotate: [0, -10, 10, -10, 10, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{ duration: 1, repeat: 2 }}
                    className="mb-6"
                >
                    <Confetti size={80} weight="duotone" className="text-accent mx-auto" />
                </motion.div>

                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl font-bold mb-2"
                >
                    🎉 Pioneer!
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-muted-foreground"
                >
                    You dropped the first pulse at
                    <br />
                    <span className="text-foreground font-semibold">{venueName}</span>
                </motion.p>
            </motion.div>
        </motion.div>
    )
}
