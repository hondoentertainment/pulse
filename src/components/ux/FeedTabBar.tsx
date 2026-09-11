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
  /** Figma 7 tabs are start-aligned with a 24px gap. */
  align?: 'start' | 'stretch'
}

/** X-style underline tab row. Accent is Pulse energy pink, not Twitter blue. */
export function FeedTabBar<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
  align = 'start',
}: FeedTabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex border-b border-border',
        align === 'start' ? 'justify-start gap-6' : undefined,
        className,
      )}
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
              'relative min-h-11 touch-manipulation px-0.5 text-[15px] font-semibold',
              align === 'stretch' ? 'flex-1 px-2' : undefined,
              selected ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {tab.label}
            {selected && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-primary"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
