import type { ReactNode } from 'react'
import { ChatCircle, Lightning, ShareNetwork } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface PulseActionRowProps {
  boostCount?: number
  onBoost?: () => void
  onReply?: () => void
  onShare?: () => void
  className?: string
}

/** X-like icon row under a pulse — energy/boost · reply · share. Not heavy buttons. */
export function PulseActionRow({
  boostCount,
  onBoost,
  onReply,
  onShare,
  className,
}: PulseActionRowProps) {
  return (
    <div className={cn('mt-2 flex max-w-xs items-center justify-between', className)}>
      <ActionIcon
        label={boostCount && boostCount > 0 ? `Boost, ${boostCount}` : 'Boost'}
        onClick={onBoost}
      >
        <Lightning size={18} />
        {boostCount !== undefined && boostCount > 0 && (
          <span className="text-[13px]">{boostCount}</span>
        )}
      </ActionIcon>
      <ActionIcon label="Reply" onClick={onReply}>
        <ChatCircle size={18} />
      </ActionIcon>
      <ActionIcon label="Share" onClick={onShare}>
        <ShareNetwork size={18} />
      </ActionIcon>
    </div>
  )
}

function ActionIcon({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full text-muted-foreground touch-manipulation hover:bg-muted hover:text-primary"
    >
      {children}
    </button>
  )
}
