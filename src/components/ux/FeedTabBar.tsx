import { cn } from '@/lib/utils'
import { signalToneClass, type SignalTone } from '@/lib/signal-tone'

export interface FeedTab<T extends string = string> {
  id: T
  label: string
  tone?: SignalTone
}

interface FeedTabBarProps<T extends string> {
  tabs: readonly FeedTab<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  className?: string
  /** Figma 7 tabs are start-aligned with a 24px gap. */
  align?: 'start' | 'stretch'
  /** Tinted chips (Tonight filters) instead of an underline row. */
  variant?: 'underline' | 'pills'
}

/** X-style underline tab row. Accent is Pulse energy pink, not Twitter blue. */
export function FeedTabBar<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
  align = 'start',
  variant = 'underline',
}: FeedTabBarProps<T>) {
  const pills = variant === 'pills'
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex',
        pills
          ? 'gap-2 overflow-x-auto [scrollbar-width:none]'
          : 'border-b border-border',
        !pills && align === 'start' ? 'justify-start gap-6' : undefined,
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
              pills
                ? 'relative min-h-8 shrink-0 touch-manipulation rounded-full px-3 py-[7px] text-[12px] font-medium leading-none'
                : 'relative min-h-11 touch-manipulation px-0.5 text-[15px] font-semibold',
              !pills && align === 'stretch' ? 'flex-1 px-2' : undefined,
              pills
                ? signalToneClass(tab.tone ?? 'cyan', selected)
                : selected
                  ? 'text-foreground'
                  : 'text-muted-foreground',
            )}
          >
            {tab.label}
            {selected && !pills && (
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
