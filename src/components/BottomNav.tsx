import { TrendUp, MapTrifold, User, Bell, Compass } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

export type TabId = 'trending' | 'discover' | 'map' | 'notifications' | 'profile'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  unreadNotifications?: number
}

export function BottomNav({ activeTab, onTabChange, unreadNotifications = 0 }: BottomNavProps) {
  const tabs = [
    { id: 'trending' as const, icon: TrendUp, label: 'Trending' },
    { id: 'discover' as const, icon: Compass, label: 'Discover' },
    { id: 'map' as const, icon: MapTrifold, label: 'Map' },
    { id: 'notifications' as const, icon: Bell, label: 'Notifications', badge: unreadNotifications },
    { id: 'profile' as const, icon: User, label: 'Profile' }
  ]

  return (
    <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              data-testid={`tab-${tab.label}`}
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
