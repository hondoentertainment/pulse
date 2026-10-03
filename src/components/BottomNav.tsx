import { youTabAriaLabel } from '@/lib/in-app-notify'

export type TabId = 'trending' | 'discover' | 'map' | 'notifications' | 'profile'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  unreadNotifications?: number
}

export function BottomNav({ activeTab, onTabChange, unreadNotifications = 0 }: BottomNavProps) {
  const tabs = [
    { id: 'map' as const, label: 'Map' },
    { id: 'trending' as const, label: 'Tonight' },
    { id: 'discover' as const, label: 'Pulse' },
    { id: 'notifications' as const, label: 'Following' },
    { id: 'profile' as const, label: 'You', badge: unreadNotifications },
  ]

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background px-5 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-2"
    >
      <div className="mx-auto flex h-14 max-w-lg items-center justify-center rounded-2xl border-t border-border bg-[#0f0f12]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`tab-${tab.label}`}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.id === 'profile' ? youTabAriaLabel(tab.badge ?? 0) : tab.label}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex h-full min-h-11 w-[70px] touch-manipulation flex-col items-center justify-center gap-1"
            >
              <span className="relative">
                <span
                  aria-hidden
                  className={`block h-[5px] w-[5px] rounded-full ${
                    isActive ? 'bg-foreground' : 'bg-[#3a3a40]'
                  }`}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-2 -right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] leading-none ${
                  isActive ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
