import { Venue } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Lightning, ShareNetwork, NavigationArrow, BookmarkSimple } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface VenueQuickActionsProps {
  venue: Venue
  onCheckIn: () => void
  onShare: () => void
  onDirections: () => void
  onSave: () => void
  isSaved?: boolean
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  isPrimary?: boolean
  isActive?: boolean
}

function ActionButton({ icon, label, onClick, isPrimary, isActive }: ActionButtonProps) {
  const handleClick = () => {
    // Trigger haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all active:scale-95',
        isPrimary
          ? 'bg-primary text-primary-foreground min-w-[64px]'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <div className={cn(
        'flex items-center justify-center',
        isPrimary ? 'w-7 h-7' : 'w-6 h-6'
      )}>
        {icon}
      </div>
      <span className={cn(
        'font-medium leading-none',
        isPrimary ? 'text-[10px]' : 'text-[10px]'
      )}>
        {label}
      </span>
    </button>
  )
}

export function VenueQuickActions({
  venue,
  onCheckIn,
  onShare,
  onDirections,
  onSave,
  isSaved = false,
}: VenueQuickActionsProps) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 25, delay: 0.3 }}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-1 px-4 py-2 rounded-full bg-card/90 backdrop-blur-xl border border-border shadow-lg shadow-black/20">
        <ActionButton
          icon={<Lightning size={22} weight="fill" />}
          label="Check In"
          onClick={onCheckIn}
          isPrimary
        />

        <ActionButton
          icon={<ShareNetwork size={20} weight="regular" />}
          label="Share"
          onClick={onShare}
        />

        <ActionButton
          icon={<NavigationArrow size={20} weight="regular" />}
          label="Directions"
          onClick={onDirections}
        />

        <ActionButton
          icon={
            <BookmarkSimple
              size={20}
              weight={isSaved ? 'fill' : 'regular'}
              className={cn(isSaved && 'text-primary')}
            />
          }
          label={isSaved ? 'Saved' : 'Save'}
          onClick={onSave}
          isActive={isSaved}
        />
      </div>
    </motion.div>
  )
}
