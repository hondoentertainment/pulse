import { Sparkle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConciergeButtonProps {
  onClick: () => void
  className?: string
  label?: string
}

/**
 * Floating "Plan tonight" CTA. Off by default — only render when
 * `featureFlags.aiConcierge` is true.
 */
export function ConciergeButton({ onClick, className, label = 'Plan tonight' }: ConciergeButtonProps) {
  return (
    <Button
      onClick={onClick}
      aria-label="Open AI Night Concierge"
      className={cn(
        'fixed bottom-24 right-4 z-40 h-12 rounded-full px-5 shadow-lg',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        className,
      )}
    >
      <Sparkle weight="fill" className="size-4" />
      <span className="font-medium">{label}</span>
    </Button>
  )
}
