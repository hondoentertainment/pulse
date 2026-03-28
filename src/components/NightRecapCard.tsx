import { motion } from 'framer-motion'
import { MapPin, Lightning, Users, ShareNetwork } from '@phosphor-icons/react'
import { ENERGY_CONFIG } from '@/lib/types'
import type { NightRecap } from '@/lib/retention-engine'

interface NightRecapCardProps {
  recap: NightRecap
  onShare?: () => void
}

function formatRecapDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  return `${dayName}, ${month} ${day}`
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

export function NightRecapCard({ recap, onShare }: NightRecapCardProps) {
  const vibeConfig = ENERGY_CONFIG[recap.topVibe]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500 via-cyan-500 to-purple-500 p-[1px]">
        <div className="absolute inset-[1px] rounded-2xl bg-zinc-900" />
      </div>

      <div className="relative z-10 p-5">
        {/* Date header */}
        <motion.div variants={itemVariants} className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">
            Last Night
          </p>
          <h3 className="text-lg font-bold text-white">
            {formatRecapDate(recap.date)}
          </h3>
        </motion.div>

        {/* Venue list */}
        <motion.div variants={itemVariants} className="space-y-2 mb-5">
          {recap.venuesVisited.map((venue) => (
            <motion.div
              key={venue.id}
              variants={itemVariants}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-800/50"
            >
              {/* Energy dot */}
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: ENERGY_CONFIG[venue.peakEnergy].color }}
              />
              <span className="text-sm text-zinc-200 flex-1 truncate">
                {venue.name}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                {ENERGY_CONFIG[venue.peakEnergy].label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-3 gap-3 mb-5"
        >
          <StatCell
            icon={<MapPin size={16} weight="fill" className="text-purple-400" />}
            value={recap.venuesVisited.length}
            label="Venues"
          />
          <StatCell
            icon={<Lightning size={16} weight="fill" className="text-cyan-400" />}
            value={recap.totalPulses}
            label="Pulses"
          />
          <StatCell
            icon={<Users size={16} weight="fill" className="text-pink-400" />}
            value={recap.friendsEncountered.length}
            label="Friends"
          />
        </motion.div>

        {/* Top vibe badge */}
        <motion.div variants={itemVariants} className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-500">Top vibe:</span>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: vibeConfig.color + '20',
              color: vibeConfig.color,
              border: `1px solid ${vibeConfig.color}40`,
            }}
          >
            {vibeConfig.emoji} {vibeConfig.label}
          </span>
        </motion.div>

        {/* Highlight moment */}
        {recap.highlightMoment && (
          <motion.div
            variants={itemVariants}
            className="mb-5 px-3 py-2.5 rounded-xl bg-zinc-800/40 border-l-2 border-purple-500/50"
          >
            <p className="text-xs text-zinc-500 mb-0.5">Highlight</p>
            <p className="text-sm text-zinc-300">{recap.highlightMoment}</p>
          </motion.div>
        )}

        {/* Share button */}
        <motion.div variants={itemVariants}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onShare}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors border border-zinc-700/50"
          >
            <ShareNetwork size={16} weight="bold" />
            Share your night
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  )
}

function StatCell({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-2 rounded-xl bg-zinc-800/40">
      {icon}
      <span className="text-lg font-bold text-white">{value}</span>
      <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</span>
    </div>
  )
}
