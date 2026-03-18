import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  X,
  MapPin,
  Lightning,
  Users,
  ArrowRight,
  CaretDown,
  CaretUp,
  MartiniGlass,
  MusicNote,
  ForkKnife,
  Coffee,
  Beer,
  Star,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { getEnergyLabel } from '@/lib/pulse-engine'
import type { TonightsPick } from '@/lib/tonights-pick'
import type { Venue } from '@/lib/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TonightsPickCardProps {
  pick: TonightsPick | null
  isLoading?: boolean
  showAlternates?: boolean
  onLetsGo?: (venue: Venue) => void
  onDismiss?: () => void
  onToggleAlternates?: () => void
  onAlternateClick?: (venue: Venue) => void
  friendAvatars?: string[]
}

// ---------------------------------------------------------------------------
// Category icon helper
// ---------------------------------------------------------------------------

function getCategoryIcon(category?: string) {
  const cat = (category ?? '').toLowerCase()
  if (cat.includes('cocktail') || cat.includes('bar') || cat.includes('lounge'))
    return <MartiniGlass size={20} weight="fill" />
  if (cat.includes('music') || cat.includes('club') || cat.includes('nightclub'))
    return <MusicNote size={20} weight="fill" />
  if (cat.includes('restaurant') || cat.includes('food'))
    return <ForkKnife size={20} weight="fill" />
  if (cat.includes('cafe') || cat.includes('coffee'))
    return <Coffee size={20} weight="fill" />
  if (cat.includes('brewery') || cat.includes('beer'))
    return <Beer size={20} weight="fill" />
  return <Star size={20} weight="fill" />
}

// ---------------------------------------------------------------------------
// Gradient based on pulse score
// ---------------------------------------------------------------------------

function getGradient(pulseScore: number): string {
  if (pulseScore >= 75) return 'from-purple-600 via-fuchsia-600 to-purple-900'
  if (pulseScore >= 50) return 'from-purple-700 via-violet-700 to-purple-950'
  return 'from-purple-800 via-indigo-800 to-zinc-900'
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.25 },
  },
}

const ringVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.2, ease: 'easeOut', delay: 0.3 },
  },
}

const alternatesVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
}

// ---------------------------------------------------------------------------
// Pulse Score Ring
// ---------------------------------------------------------------------------

function PulseScoreRing({ score }: { score: number }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const progress = score / 100
  const prefersReducedMotion = useReducedMotion()

  return (
    <div
      className="relative w-14 h-14 flex items-center justify-center"
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Pulse score: ${score} out of 100`}
    >
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 52 52" aria-hidden="true">
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="3"
        />
        <motion.circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          variants={prefersReducedMotion ? undefined : ringVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? false : "visible"}
        />
      </svg>
      <span className="text-sm font-bold text-white" aria-hidden="true">{score}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

function PickSkeleton() {
  return (
    <div className="w-full rounded-2xl bg-gradient-to-br from-purple-800/50 via-indigo-800/50 to-zinc-900/50 p-5 animate-pulse" data-testid="pick-skeleton">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-3 w-24 rounded bg-white/10 mb-2" />
          <div className="h-6 w-48 rounded bg-white/15" />
        </div>
        <div className="w-14 h-14 rounded-full bg-white/10" />
      </div>
      <div className="h-4 w-64 rounded bg-white/10 mb-4" />
      <div className="flex gap-2">
        <div className="h-10 flex-1 rounded-xl bg-white/10" />
        <div className="h-10 w-36 rounded-xl bg-white/10" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alternate venue card
// ---------------------------------------------------------------------------

function AlternateVenueCard({
  venue,
  onClick,
}: {
  venue: Venue
  onClick?: (venue: Venue) => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(venue)}
      className="shrink-0 w-44 rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-3 text-left"
      aria-label={`Alternative: ${venue.name}, ${getEnergyLabel(venue.pulseScore)}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-purple-400">{getCategoryIcon(venue.category)}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {getEnergyLabel(venue.pulseScore)}
        </span>
      </div>
      <p className="text-sm font-semibold text-white truncate">{venue.name}</p>
      <p className="text-xs text-zinc-400 truncate">{venue.category}</p>
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TonightsPickCard({
  pick,
  isLoading = false,
  showAlternates = false,
  onLetsGo,
  onDismiss,
  onToggleAlternates,
  onAlternateClick,
  friendAvatars,
}: TonightsPickCardProps) {
  const prefersReducedMotion = useReducedMotion()

  if (isLoading) return <PickSkeleton />
  if (!pick) return null

  const { venue, explanation, alternates } = pick
  const gradient = getGradient(venue.pulseScore)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={venue.id}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full"
        data-testid="tonights-pick-card"
      >
        {/* Main card */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5',
            gradient,
          )}
        >
          {/* Shimmer overlay */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
              aria-hidden="true"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatDelay: 4,
                ease: 'easeInOut',
              }}
            />
          )}

          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors z-10"
            aria-label="Dismiss tonight's pick"
            data-testid="dismiss-button"
          >
            <X size={14} weight="bold" className="text-white/70" />
          </button>

          {/* Header row */}
          <div className="relative z-10 flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-12">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-purple-200" aria-hidden="true">
                  {getCategoryIcon(venue.category)}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-200/70">
                  Tonight's Pick
                </span>
              </div>
              <h3 className="text-xl font-bold text-white truncate">{venue.name}</h3>
              {venue.category && (
                <p className="text-xs text-purple-200/60 mt-0.5">{venue.category}</p>
              )}
            </div>
            <PulseScoreRing score={venue.pulseScore} />
          </div>

          {/* Explanation */}
          <p className="relative z-10 text-sm text-purple-100/80 mb-4 leading-relaxed">
            {explanation}
          </p>

          {/* Friend avatars row */}
          {friendAvatars && friendAvatars.length > 0 && (
            <div className="relative z-10 flex items-center gap-1.5 mb-4" data-testid="friend-avatars" aria-label={`${friendAvatars.length} friends are here`}>
              <Users size={14} weight="fill" className="text-purple-200/60" aria-hidden="true" />
              <div className="flex -space-x-2">
                {friendAvatars.slice(0, 5).map((avatar, i) => (
                  <img
                    key={i}
                    src={avatar}
                    alt="Friend avatar"
                    className="w-6 h-6 rounded-full border-2 border-purple-900/50 object-cover"
                  />
                ))}
              </div>
              {friendAvatars.length > 5 && (
                <span className="text-xs text-purple-200/60 ml-1">
                  +{friendAvatars.length - 5} more
                </span>
              )}
            </div>
          )}

          {/* CTA buttons */}
          <div className="relative z-10 flex gap-2">
            <motion.button
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              onClick={() => onLetsGo?.(venue)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-purple-900 text-sm font-bold transition-colors hover:bg-purple-50"
              data-testid="lets-go-button"
              aria-label={`Let's go to ${venue.name}`}
            >
              <Lightning size={16} weight="fill" aria-hidden="true" />
              Let's Go
              <ArrowRight size={14} weight="bold" aria-hidden="true" />
            </motion.button>

            {alternates.length > 0 && (
              <motion.button
                whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                onClick={onToggleAlternates}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 text-white/80 text-sm font-semibold hover:bg-white/15 transition-colors"
                data-testid="see-alternatives-button"
                aria-expanded={showAlternates}
                aria-label="See alternative venues"
              >
                See Alternatives
                {showAlternates ? (
                  <CaretUp size={14} weight="bold" />
                ) : (
                  <CaretDown size={14} weight="bold" />
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Alternates section */}
        <AnimatePresence>
          {showAlternates && alternates.length > 0 && (
            <motion.div
              variants={alternatesVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="overflow-hidden"
              data-testid="alternates-section"
            >
              <div className="flex gap-3 overflow-x-auto pt-3 pb-1 scrollbar-hide">
                {alternates.map((altVenue) => (
                  <AlternateVenueCard
                    key={altVenue.id}
                    venue={altVenue}
                    onClick={onAlternateClick}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
