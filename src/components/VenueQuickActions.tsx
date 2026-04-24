import type { ReactNode } from 'react'
import { BookmarkSimple, CalendarBlank, Car, Lightning, MapPin, ShareNetwork } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface VenueQuickActionsProps {
  onCheckIn: () => void
  onShare: () => void
  onDirections: () => void
  onRide: () => void
  onReserve: () => void
  onWatchSurge: () => void
  onSave: () => void
  isSaved?: boolean
  isWatchingSurge?: boolean
  canReserve?: boolean
}

interface ActionButtonProps {
  icon: ReactNode
  label: string
  onClick: () => void
  isPrimary?: boolean
  isActive?: boolean
  disabled?: boolean
}

function ActionButton({ icon, label, onClick, isPrimary, isActive, disabled }: ActionButtonProps) {
  const handleClick = () => {
    if (disabled) return
    if (navigator.vibrate) navigator.vibrate(10)
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all active:scale-95',
        isPrimary
          ? 'min-w-[64px] bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground',
        isActive && !isPrimary && 'text-primary',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      <div className={cn('flex items-center justify-center', isPrimary ? 'h-7 w-7' : 'h-6 w-6')}>
        {icon}
      </div>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  )
}

export function VenueQuickActions({
  onCheckIn,
  onShare,
  onDirections,
  onRide,
  onReserve,
  onWatchSurge,
  onSave,
  isSaved = false,
  isWatchingSurge = false,
  canReserve = true,
}: VenueQuickActionsProps) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 25, delay: 0.3 }}
      className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2"
    >
      <div className="flex items-center gap-1 rounded-full border border-border bg-card/90 px-4 py-2 shadow-lg shadow-black/20 backdrop-blur-xl">
        <ActionButton
          icon={<Lightning size={22} weight="fill" />}
          label="Pulse"
          onClick={onCheckIn}
          isPrimary
        />
        <ActionButton
          icon={<MapPin size={20} weight="regular" />}
          label="Go"
          onClick={onDirections}
        />
        <ActionButton
          icon={<Car size={20} weight="regular" />}
          label="Ride"
          onClick={onRide}
        />
        <ActionButton
          icon={<CalendarBlank size={20} weight={canReserve ? 'regular' : 'thin'} />}
          label="Reserve"
          onClick={onReserve}
          disabled={!canReserve}
        />
        <ActionButton
          icon={<ShareNetwork size={20} weight="regular" />}
          label="Share"
          onClick={onShare}
        />
        <ActionButton
          icon={<Lightning size={20} weight={isWatchingSurge ? 'fill' : 'regular'} />}
          label={isWatchingSurge ? 'Watching' : 'Watch'}
          onClick={onWatchSurge}
          isActive={isWatchingSurge}
        />
        <ActionButton
          icon={<BookmarkSimple size={20} weight={isSaved ? 'fill' : 'regular'} />}
          label={isSaved ? 'Saved' : 'Save'}
          onClick={onSave}
          isActive={isSaved}
        />
      </div>
    </motion.div>
  )
}
