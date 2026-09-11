import { cn } from '@/lib/utils'

export interface FeedTab<T extends string = string> {
  id: T
  label: string
}

interface FeedTabBarProps<T extends string> {
  tabs: readonly FeedTab<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  className?: string
}

/** X-style underline tab row. Accent is Pulse energy pink, not Twitter blue. */
export function FeedTabBar<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
}: FeedTabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex border-b border-border', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`feed-tab-${tab.id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative min-h-11 flex-1 touch-manipulation px-2 text-[15px] font-semibold',
              selected ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {tab.label}
            {selected && (
              <span
                aria-hidden
                className="absolute inset-x-6 bottom-0 h-[3px] rounded-full bg-primary"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
