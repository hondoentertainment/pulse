import { CalendarBlank, Car, Lightning, MapPin, SealCheck, Ticket } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { VenueActionCta } from '@/lib/venue-action-ctas'
import { cn } from '@/lib/utils'

interface VenueActionPanelProps {
  actions: VenueActionCta[]
  onAction: (action: VenueActionCta) => void
}

const ACTION_ICONS = {
  directions: MapPin,
  ride: Car,
  reserve: CalendarBlank,
  tickets: Ticket,
  surge_watch: Lightning,
  guest_list: SealCheck,
} as const

export function VenueActionPanel({ actions, onAction }: VenueActionPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Tonight's Move</h2>
          <p className="text-sm text-muted-foreground">Leave with a plan, not just a hunch.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actions.map(action => (
          <VenueActionCard
            key={action.id}
            action={action}
            onClick={() => onAction(action)}
          />
        ))}
      </div>
    </div>
  )
}

function VenueActionCard({ action, onClick }: { action: VenueActionCta; onClick: () => void }) {
  const Icon = ACTION_ICONS[action.id]
  const isDisabled = Boolean(action.disabledReason) || action.kind === 'status'

  return (
    <motion.button
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      onClick={isDisabled ? undefined : onClick}
      className={cn(
        'rounded-2xl border p-4 text-left transition-colors',
        action.tone === 'primary' && 'border-primary/25 bg-primary/10 hover:border-primary/45',
        action.tone === 'accent' && 'border-amber-500/25 bg-amber-500/10 hover:border-amber-500/45',
        action.tone === 'success' && 'border-emerald-500/25 bg-emerald-500/10 hover:border-emerald-500/45',
        action.tone === 'secondary' && 'border-border bg-card hover:border-primary/25',
        isDisabled && 'cursor-default opacity-90'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl bg-background/70 p-2">
          <Icon
            size={18}
            weight={action.isActive ? 'fill' : 'regular'}
            className={cn(
              action.tone === 'primary' && 'text-primary',
              action.tone === 'accent' && 'text-amber-400',
              action.tone === 'success' && 'text-emerald-400',
              action.tone === 'secondary' && 'text-muted-foreground'
            )}
          />
        </div>
        {action.badge && (
          <span className="rounded-full bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground">
            {action.badge}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm font-semibold">{action.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
      {action.disabledReason && (
        <p className="mt-2 text-[11px] text-muted-foreground">{action.disabledReason}</p>
      )}
    </motion.button>
  )
}
