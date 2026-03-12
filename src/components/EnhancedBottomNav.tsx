import { useCallback, useRef } from 'react'
import { TrendUp, MapTrifold, User, Bell, Compass } from '@phosphor-icons/react'
import { motion, useAnimation, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

export type TabId = 'trending' | 'discover' | 'map' | 'notifications' | 'profile'

interface EnhancedBottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  unreadNotifications?: number
}

interface TabConfig {
  id: TabId
  icon: PhosphorIcon
  label: string
  badge?: number
}

const iconBounceVariants: Variants = {
  tap: {
    scale: [0.85, 1.15, 1.0],
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 15,
      times: [0, 0.6, 1],
      duration: 0.4,
    },
  },
  idle: {
    scale: 1,
  },
}

const glowDotVariants: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: 0.15 },
  },
}

const badgePulseVariants: Variants = {
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(239, 68, 68, 0.7)',
      '0 0 0 6px rgba(239, 68, 68, 0)',
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeOut',
    },
  },
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10)
    } catch {
      // Silently ignore if vibration fails
    }
  }
}

function TabButton({
  tab,
  isActive,
  onPress,
}: {
  tab: TabConfig
  isActive: boolean
  onPress: () => void
}) {
  const controls = useAnimation()
  const Icon = tab.icon
  const isMap = tab.id === 'map'

  const handlePress = useCallback(() => {
    triggerHaptic()
    controls.start('tap').then(() => controls.start('idle'))
    onPress()
  }, [controls, onPress])

  return (
    <button
      onClick={handlePress}
      className="flex flex-col items-center justify-center flex-1 h-full relative"
      aria-label={tab.label}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="relative z-10 flex flex-col items-center gap-1">
        {/* Icon container with bounce + scale + optional rotation */}
        <motion.div
          className="relative"
          variants={iconBounceVariants}
          animate={controls}
          initial="idle"
        >
          <motion.div
            animate={{
              scale: isActive ? 1.1 : 1,
              rotate: isMap && isActive ? 12 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 350,
              damping: 20,
            }}
          >
            <Icon
              size={24}
              weight={isActive ? 'fill' : 'regular'}
              className={cn(
                'transition-colors duration-200',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </motion.div>

          {/* Notification badge with pulse glow */}
          {tab.badge !== undefined && tab.badge > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-2"
            >
              <motion.div
                variants={badgePulseVariants}
                animate="animate"
                className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold"
              >
                {tab.badge > 9 ? '9+' : tab.badge}
              </motion.div>
            </motion.div>
          )}
        </motion.div>

        {/* Label */}
        <span
          className={cn(
            'text-[10px] font-medium transition-colors duration-200',
            isActive ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {tab.label}
        </span>

        {/* Glowing dot indicator */}
        {isActive && (
          <motion.div
            variants={glowDotVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary"
            style={{
              boxShadow: 'hsl(var(--primary)) 0px 0px 6px 1px',
            }}
          />
        )}
      </div>
    </button>
  )
}

export function EnhancedBottomNav({
  activeTab,
  onTabChange,
  unreadNotifications = 0,
}: EnhancedBottomNavProps) {
  const tabs: TabConfig[] = [
    { id: 'trending', icon: TrendUp, label: 'Trending' },
    { id: 'discover', icon: Compass, label: 'Discover' },
    { id: 'map', icon: MapTrifold, label: 'Map' },
    {
      id: 'notifications',
      icon: Bell,
      label: 'Alerts',
      badge: unreadNotifications,
    },
    { id: 'profile', icon: User, label: 'Profile' },
  ]

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-card/80 backdrop-blur-xl',
        'border-t border-border/50',
        'pb-[env(safe-area-inset-bottom,0px)]'
      )}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onPress={() => onTabChange(tab.id)}
          />
        ))}
      </div>
    </nav>
  )
}
