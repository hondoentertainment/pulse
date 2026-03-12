'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ShareNetwork, Link, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Venue, EnergyRating } from '@/lib/types'
import type { ReactNode } from 'react'

interface ShareableVenueCardProps {
  venue: Venue
  onShare: () => void
  onClose: () => void
}

function getEnergyLevel(score: number): EnergyRating {
  if (score >= 75) return 'electric'
  if (score >= 50) return 'buzzing'
  if (score >= 25) return 'chill'
  return 'dead'
}

const ENERGY_GRADIENT: Record<EnergyRating, { from: string; via: string; to: string }> = {
  electric: {
    from: 'from-fuchsia-600',
    via: 'via-purple-700',
    to: 'to-violet-900',
  },
  buzzing: {
    from: 'from-rose-500',
    via: 'via-pink-600',
    to: 'to-red-800',
  },
  chill: {
    from: 'from-sky-400',
    via: 'via-blue-600',
    to: 'to-indigo-800',
  },
  dead: {
    from: 'from-slate-500',
    via: 'via-slate-700',
    to: 'to-slate-900',
  },
}

const ENERGY_LABEL: Record<EnergyRating, string> = {
  electric: 'Electric',
  buzzing: 'Buzzing',
  chill: 'Chill',
  dead: 'Dead',
}

const GLOW_COLOR: Record<EnergyRating, string> = {
  electric: 'drop-shadow-[0_0_40px_rgba(217,70,239,0.6)]',
  buzzing: 'drop-shadow-[0_0_40px_rgba(244,63,94,0.5)]',
  chill: 'drop-shadow-[0_0_40px_rgba(56,189,248,0.4)]',
  dead: 'drop-shadow-[0_0_20px_rgba(148,163,184,0.3)]',
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ShareableVenueCard({
  venue,
  onShare,
  onClose,
}: ShareableVenueCardProps): ReactNode {
  const energy = getEnergyLevel(venue.pulseScore)
  const gradient = ENERGY_GRADIENT[energy]

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Content */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-4"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute -top-2 right-0 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X size={18} weight="bold" />
          </button>

          {/* Shareable Card - 9:16 aspect ratio */}
          <div
            className={cn(
              'relative flex aspect-[9/16] w-72 flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-b p-6',
              gradient.from,
              gradient.via,
              gradient.to
            )}
          >
            {/* Noise texture overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                backgroundSize: '128px 128px',
              }}
            />

            {/* Date stamp */}
            <div className="relative z-10 self-end">
              <span className="text-xs font-medium text-white/50">
                {formatDate()}
              </span>
            </div>

            {/* Center content */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
              {/* Category badge */}
              {venue.category && (
                <Badge
                  variant="secondary"
                  className="border-white/20 bg-white/15 text-white backdrop-blur-sm"
                >
                  {venue.category}
                </Badge>
              )}

              {/* Venue name */}
              <h2
                className="max-w-full text-center text-2xl font-bold leading-tight text-white"
                style={{ textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
              >
                {venue.name}
              </h2>

              {/* Huge pulse score */}
              <div className={cn('relative', GLOW_COLOR[energy])}>
                <span
                  className="block text-center font-bold leading-none text-white"
                  style={{
                    fontSize: '120px',
                    textShadow: '0 4px 24px rgba(0,0,0,0.2)',
                  }}
                >
                  {venue.pulseScore}
                </span>
              </div>

              {/* Energy level */}
              <span
                className="text-lg font-semibold uppercase tracking-widest text-white/80"
              >
                {ENERGY_LABEL[energy]}
              </span>
            </div>

            {/* Watermark */}
            <div className="relative z-10 self-center">
              <span
                className="text-xs font-medium tracking-wider text-white/30"
              >
                via Pulse
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex w-full gap-3">
            <Button
              onClick={onShare}
              className="flex-1 gap-2 bg-white text-black hover:bg-white/90"
              size="lg"
            >
              <ShareNetwork size={18} weight="bold" />
              Share to Stories
            </Button>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(
                  `${venue.name} - Pulse Score: ${venue.pulseScore}`
                )
              }}
              variant="outline"
              className="flex-1 gap-2 border-white/20 text-white hover:bg-white/10"
              size="lg"
            >
              <Link size={18} weight="bold" />
              Copy Link
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
