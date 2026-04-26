import { useState, ReactNode } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { Fire, Lightning, Eye, Skull } from '@phosphor-icons/react'
import { useHaptics } from '@/hooks/use-haptics'

interface SwipeableCardProps {
    children: ReactNode
    onSwipeLeft?: () => void
    onSwipeRight?: () => void
    leftAction?: ReactNode
    rightAction?: ReactNode
    disabled?: boolean
}

export function SwipeableCard({
    children,
    onSwipeLeft,
    onSwipeRight,
    leftAction,
    rightAction,
    disabled = false
}: SwipeableCardProps) {
    const x = useMotionValue(0)
    const [_isDragging, setIsDragging] = useState(false)
    const { triggerLight, triggerMedium } = useHaptics()

    const leftOpacity = useTransform(x, [-100, -50, 0], [1, 0.5, 0])
    const rightOpacity = useTransform(x, [0, 50, 100], [0, 0.5, 1])
    const scale = useTransform(x, [-100, 0, 100], [0.95, 1, 0.95])

    const handleDragStart = () => {
        setIsDragging(true)
    }

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsDragging(false)

        if (disabled) return

        if (info.offset.x < -80 && onSwipeLeft) {
            triggerMedium()
            onSwipeLeft()
        } else if (info.offset.x > 80 && onSwipeRight) {
            triggerMedium()
            onSwipeRight()
        } else {
            triggerLight()
        }
    }

    return (
        <div className="relative overflow-hidden">
            {/* Left action indicator */}
            <motion.div
                className="absolute inset-y-0 left-0 flex items-center justify-center w-20 bg-gradient-to-r from-accent/20 to-transparent"
                style={{ opacity: leftOpacity }}
            >
                {leftAction || (
                    <div className="p-2 rounded-full bg-accent/30">
                        <Fire size={24} weight="fill" className="text-accent" />
                    </div>
                )}
            </motion.div>

            {/* Right action indicator */}
            <motion.div
                className="absolute inset-y-0 right-0 flex items-center justify-center w-20 bg-gradient-to-l from-destructive/20 to-transparent"
                style={{ opacity: rightOpacity }}
            >
                {rightAction || (
                    <div className="p-2 rounded-full bg-destructive/30">
                        <Skull size={24} weight="fill" className="text-destructive" />
                    </div>
                )}
            </motion.div>

            {/* Main content */}
            <motion.div
                drag={disabled ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.1}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                style={{ x, scale }}
                className="relative z-10 bg-card"
            >
                {children}
            </motion.div>
        </div>
    )
}

interface QuickReactionsProps {
    onReact: (type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
    reactions: {
        fire: string[]
        eyes: string[]
        skull: string[]
        lightning: string[]
    }
    currentUserId?: string
    disabled?: boolean
}

export function QuickReactions({ onReact, reactions, currentUserId, disabled = false }: QuickReactionsProps) {
    const { triggerLight } = useHaptics()

    const handleReact = (type: 'fire' | 'eyes' | 'skull' | 'lightning') => {
        if (disabled) return
        triggerLight()
        onReact(type)
    }

    const isActive = (type: 'fire' | 'eyes' | 'skull' | 'lightning') =>
        currentUserId && reactions[type].includes(currentUserId)

    return (
        <motion.div
            className="flex items-center gap-1 py-1"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <button
                onClick={() => handleReact('fire')}
                disabled={disabled}
                aria-label={`Fire reaction${isActive('fire') ? ', active' : ''}`}
                aria-pressed={!!isActive('fire')}
                className={`p-1.5 rounded-full transition-all ${isActive('fire')
                        ? 'bg-accent/20 text-accent scale-110'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
            >
                <Fire size={16} weight={isActive('fire') ? 'fill' : 'regular'} />
            </button>
            <button
                onClick={() => handleReact('lightning')}
                disabled={disabled}
                aria-label={`Lightning reaction${isActive('lightning') ? ', active' : ''}`}
                aria-pressed={!!isActive('lightning')}
                className={`p-1.5 rounded-full transition-all ${isActive('lightning')
                        ? 'bg-accent/20 text-accent scale-110'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
            >
                <Lightning size={16} weight={isActive('lightning') ? 'fill' : 'regular'} />
            </button>
            <button
                onClick={() => handleReact('eyes')}
                disabled={disabled}
                aria-label={`Eyes reaction${isActive('eyes') ? ', active' : ''}`}
                aria-pressed={!!isActive('eyes')}
                className={`p-1.5 rounded-full transition-all ${isActive('eyes')
                        ? 'bg-accent/20 text-accent scale-110'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
            >
                <Eye size={16} weight={isActive('eyes') ? 'fill' : 'regular'} />
            </button>
            <button
                onClick={() => handleReact('skull')}
                disabled={disabled}
                aria-label={`Skull reaction${isActive('skull') ? ', active' : ''}`}
                aria-pressed={!!isActive('skull')}
                className={`p-1.5 rounded-full transition-all ${isActive('skull')
                        ? 'bg-accent/20 text-accent scale-110'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
            >
                <Skull size={16} weight={isActive('skull') ? 'fill' : 'regular'} />
            </button>
        </motion.div>
    )
}
