import { TrendUp, MapTrifold, User, Bell } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface BottomNavProps {
  activeTab: 'trending' | 'map' | 'notifications' | 'profile'
  onTabChange: (tab: 'trending' | 'map' | 'notifications' | 'profile') => void
  unreadNotifications?: number
}

export function BottomNav({ activeTab, onTabChange, unreadNotifications = 0 }: BottomNavProps) {
  const tabs = [
    { id: 'trending' as const, icon: TrendUp, label: 'Trending' },
    { id: 'map' as const, icon: MapTrifold, label: 'Map' },
    { id: 'notifications' as const, icon: Bell, label: 'Notifications', badge: unreadNotifications },
    { id: 'profile' as const, icon: User, label: 'Profile' }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center flex-1 h-full relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-lg"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              
              <div className="relative z-10 flex flex-col items-center gap-1">
                <div className="relative">
                  <Icon
                    size={24}
                    weight={isActive ? 'fill' : 'regular'}
                    className={`transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-[10px] font-bold"
                    >
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </motion.div>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
