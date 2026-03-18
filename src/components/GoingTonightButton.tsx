import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Check, DotsThreeVertical, Clock, X, Question } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/types'
import type { RSVPStatus, ArrivalEstimate, VenueRSVP } from '@/lib/going-tonight'

// ── Types ────────────────────────────────────────────────────

interface GoingTonightButtonProps {
  venueId: string
  currentStatus: VenueRSVP | null
  friendsGoing: User[]
  onMarkGoing: (venueId: string, arrivalEstimate?: ArrivalEstimate) => void
  onMarkMaybe: (venueId: string) => void
  onCancel: (venueId: string) => void
}

// ── Confetti Particle ────────────────────────────────────────

function ConfettiParticle({ index }: { index: number }) {
  const angle = (index / 8) * Math.PI * 2
  const distance = 40 + Math.random() * 30
  const colors = [
    'var(--color-primary)',
    'var(--color-accent)',
    '#f472b6',
    '#a78bfa',
    '#34d399',
    '#fbbf24',
  ]

  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{
        backgroundColor: colors[index % colors.length],
        top: '50%',
        left: '50%',
      }}
      initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      animate={{
        opacity: 0,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        scale: 0,
      }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  )
}

// ── Arrival Time Options ─────────────────────────────────────

const ARRIVAL_OPTIONS: ArrivalEstimate[] = ['Around 9', 'Around 10', 'Around 11', 'Late night']

// ── Component ────────────────────────────────────────────────

export function GoingTonightButton({
  venueId,
  currentStatus,
  friendsGoing,
  onMarkGoing,
  onMarkMaybe,
  onCancel,
}: GoingTonightButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showArrivalPicker, setShowArrivalPicker] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const status: RSVPStatus | 'none' = currentStatus?.status ?? 'none'

  const handleTap = useCallback(() => {
    if (status === 'none') {
      // Not going → going (with confetti)
      onMarkGoing(venueId)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 700)
    } else if (status === 'going' || status === 'maybe') {
      // Already going/maybe → show menu
      setShowMenu(prev => !prev)
    }
  }, [status, venueId, onMarkGoing])

  const handleMarkMaybe = useCallback(() => {
    onMarkMaybe(venueId)
    setShowMenu(false)
  }, [venueId, onMarkMaybe])

  const handleCancel = useCallback(() => {
    onCancel(venueId)
    setShowMenu(false)
  }, [venueId, onCancel])

  const handleArrivalSelect = useCallback(
    (arrival: ArrivalEstimate) => {
      onMarkGoing(venueId, arrival)
      setShowArrivalPicker(false)
      setShowMenu(false)
    },
    [venueId, onMarkGoing]
  )

  const displayedFriends = friendsGoing.slice(0, 3)
  const overflowCount = friendsGoing.length - 3

  return (
    <div className="relative">
      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="assertive">
        {status === 'going' && "You're now going tonight"}
        {status === 'maybe' && "You're marked as maybe tonight"}
      </div>

      {/* Main Button */}
      <motion.button
        onClick={handleTap}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
        className={cn(
          'relative flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all',
          status === 'none' &&
            'border-2 border-border bg-card text-foreground hover:border-primary/50',
          status === 'maybe' &&
            'border-2 border-dashed border-amber-400/60 bg-amber-400/10 text-amber-300',
          status === 'going' &&
            'border-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25'
        )}
        data-testid="going-tonight-button"
        data-status={status}
        aria-pressed={status === 'going'}
        aria-expanded={showMenu}
        aria-label={
          status === 'going' ? "I'm Going Tonight" :
          status === 'maybe' ? 'Maybe Tonight' :
          'Going Tonight?'
        }
      >
        {/* Status icon */}
        <div className="flex-shrink-0">
          {status === 'going' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Check size={20} weight="bold" />
            </motion.div>
          )}
          {status === 'maybe' && <Question size={20} weight="bold" />}
          {status === 'none' && <Clock size={20} weight="bold" className="text-muted-foreground" />}
        </div>

        {/* Label */}
        <span className="flex-1 text-left">
          {status === 'going' && "I'm Going Tonight"}
          {status === 'maybe' && 'Maybe Tonight'}
          {status === 'none' && 'Going Tonight?'}
        </span>

        {/* Arrival estimate badge */}
        {currentStatus?.arrivalEstimate && (
          <span className="text-xs opacity-75 font-normal">
            {currentStatus.arrivalEstimate}
          </span>
        )}

        {/* Friend avatars */}
        {friendsGoing.length > 0 && (
          <div className="flex items-center -space-x-2" data-testid="friend-avatars">
            {displayedFriends.map((friend) => (
              <img
                key={friend.id}
                src={friend.profilePhoto ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`}
                alt={friend.username}
                title={friend.username}
                className="w-6 h-6 rounded-full border-2 border-card object-cover"
              />
            ))}
            {overflowCount > 0 && (
              <span
                className="flex items-center justify-center w-6 h-6 rounded-full bg-muted border-2 border-card text-[10px] font-bold text-muted-foreground"
                data-testid="avatar-overflow"
              >
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* Menu indicator when active */}
        {(status === 'going' || status === 'maybe') && (
          <DotsThreeVertical size={18} weight="bold" className="opacity-60" />
        )}

        {/* Confetti particles */}
        <AnimatePresence>
          {showConfetti && !prefersReducedMotion && (
            <div className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <ConfettiParticle key={i} index={i} />
              ))}
            </div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
            data-testid="going-menu"
            role="menu"
            aria-label="RSVP options"
          >
            {/* Arrival Time Picker */}
            {showArrivalPicker ? (
              <div className="p-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1" id="arrival-picker-label">
                  When are you arriving?
                </p>
                {ARRIVAL_OPTIONS.map((time) => (
                  <button
                    key={time}
                    role="menuitem"
                    onClick={() => handleArrivalSelect(time)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors',
                      currentStatus?.arrivalEstimate === time && 'bg-primary/10 text-primary font-medium'
                    )}
                    data-testid={`arrival-${time}`}
                  >
                    <Clock size={14} weight="fill" className="inline mr-2 opacity-60" aria-hidden="true" />
                    {time}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {status !== 'going' && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      onMarkGoing(venueId)
                      setShowMenu(false)
                      setShowConfetti(true)
                      setTimeout(() => setShowConfetti(false), 700)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors text-emerald-400"
                    data-testid="menu-going"
                  >
                    <Check size={16} weight="bold" aria-hidden="true" />
                    I'm Going
                  </button>
                )}
                {status !== 'maybe' && (
                  <button
                    role="menuitem"
                    onClick={handleMarkMaybe}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors text-amber-400"
                    data-testid="menu-maybe"
                  >
                    <Question size={16} weight="bold" aria-hidden="true" />
                    Maybe
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => setShowArrivalPicker(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors text-muted-foreground"
                  data-testid="menu-arrival"
                >
                  <Clock size={16} weight="bold" aria-hidden="true" />
                  Set Arrival Time
                </button>
                <div className="border-t border-border my-1" role="separator" />
                <button
                  role="menuitem"
                  onClick={handleCancel}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors text-red-400"
                  data-testid="menu-cancel"
                >
                  <X size={16} weight="bold" aria-hidden="true" />
                  Cancel Plans
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
