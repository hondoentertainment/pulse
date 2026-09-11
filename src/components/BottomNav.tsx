import { TrendUp, MapTrifold, User, Users, Pulse } from '@phosphor-icons/react'

export type TabId = 'trending' | 'discover' | 'map' | 'notifications' | 'profile'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  unreadNotifications?: number
}

export function BottomNav({ activeTab, onTabChange, unreadNotifications = 0 }: BottomNavProps) {
  const tabs = [
    { id: 'map' as const, icon: MapTrifold, label: 'Map' },
    { id: 'trending' as const, icon: TrendUp, label: 'Trending' },
    { id: 'discover' as const, icon: Pulse, label: 'Pulse' },
    { id: 'notifications' as const, icon: Users, label: 'Friends', badge: unreadNotifications },
    { id: 'profile' as const, icon: User, label: 'You' },
  ]

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`tab-${tab.label}`}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.badge && tab.badge > 0 ? `${tab.label}, ${tab.badge} unread` : tab.label}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex h-full min-h-11 flex-1 touch-manipulation flex-col items-center justify-center"
            >
              <div className="relative z-10 flex flex-col items-center gap-1">
                <div className="relative">
                  <Icon
                    size={22}
                    weight={isActive ? 'fill' : 'regular'}
                    className={isActive ? 'text-foreground' : 'text-muted-foreground'}
                  />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </div>
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold leading-none ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </span>
              </div>
              {isActive && (
                <span aria-hidden className="absolute inset-x-6 bottom-1 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
