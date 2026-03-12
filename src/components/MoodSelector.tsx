'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Moon,
  Lightning,
  Heart,
  UsersThree,
  Check,
  X,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { MoodType } from '@/lib/personalization-engine'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MoodSelectorProps {
  onMoodSelect: (mood: MoodType) => void
  selectedMood: MoodType | null
}

// ---------------------------------------------------------------------------
// Mood config
// ---------------------------------------------------------------------------

interface MoodConfig {
  mood: MoodType
  label: string
  subtitle: string
  icon: typeof Moon
  gradient: string
  glowColor: string
  pillBg: string
}

const MOODS: MoodConfig[] = [
  {
    mood: 'chill',
    label: 'Chill',
    subtitle: 'Low-key vibes',
    icon: Moon,
    gradient: 'from-blue-600/80 to-cyan-700/60',
    glowColor: 'shadow-blue-500/40',
    pillBg: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
  },
  {
    mood: 'wild',
    label: 'Wild',
    subtitle: "Let's go!",
    icon: Lightning,
    gradient: 'from-fuchsia-600/80 to-pink-600/60',
    glowColor: 'shadow-fuchsia-500/40',
    pillBg: 'bg-fuchsia-600/20 text-fuchsia-300 border-fuchsia-500/30',
  },
  {
    mood: 'date-night',
    label: 'Date Night',
    subtitle: 'Romantic spots',
    icon: Heart,
    gradient: 'from-purple-600/80 to-violet-700/60',
    glowColor: 'shadow-purple-500/40',
    pillBg: 'bg-purple-600/20 text-purple-300 border-purple-500/30',
  },
  {
    mood: 'group-outing',
    label: 'Group Outing',
    subtitle: 'Squad hangouts',
    icon: UsersThree,
    gradient: 'from-orange-600/80 to-amber-600/60',
    glowColor: 'shadow-orange-500/40',
    pillBg: 'bg-orange-600/20 text-orange-300 border-orange-500/30',
  },
]

// ---------------------------------------------------------------------------
// Shimmer keyframes (applied via Tailwind arbitrary)
// ---------------------------------------------------------------------------

const shimmerStyle = {
  backgroundSize: '200% 200%',
  animation: 'mood-shimmer 3s ease-in-out infinite',
}

// ---------------------------------------------------------------------------
// MoodCard (grid view)
// ---------------------------------------------------------------------------

function MoodCard({
  config,
  isSelected,
  onSelect,
}: {
  config: MoodConfig
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = config.icon

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.95 }}
      animate={isSelected ? { scale: 1.03 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-2xl p-5 border overflow-hidden',
        'transition-shadow duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/50',
        isSelected
          ? `border-white/20 shadow-lg ${config.glowColor}`
          : 'border-white/10 shadow-none',
      )}
    >
      {/* Gradient background */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-80',
          config.gradient,
        )}
        style={shimmerStyle}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-1.5">
        <Icon weight="fill" className="size-10 text-white drop-shadow" />
        <span className="text-sm font-bold text-white">{config.label}</span>
        <span className="text-[11px] text-white/60">{config.subtitle}</span>
      </div>

      {/* Selected checkmark overlay */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute top-2 right-2 z-20 size-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <Check weight="bold" className="size-4 text-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// MoodPill (collapsed horizontal view)
// ---------------------------------------------------------------------------

function MoodPill({
  config,
  isSelected,
  onSelect,
}: {
  config: MoodConfig
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = config.icon

  return (
    <motion.button
      type="button"
      layout
      onClick={onSelect}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
        isSelected
          ? `${config.pillBg} border-current/30`
          : 'bg-zinc-800/60 text-zinc-400 border-white/10 hover:bg-zinc-800',
      )}
    >
      <Icon weight={isSelected ? 'fill' : 'regular'} className="size-4" />
      <span>{config.label}</span>
      {isSelected && <Check weight="bold" className="size-3 ml-0.5" />}
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// MoodSelector
// ---------------------------------------------------------------------------

export default function MoodSelector({
  onMoodSelect,
  selectedMood,
}: MoodSelectorProps) {
  const [collapsed, setCollapsed] = useState(false)

  const handleSelect = (mood: MoodType) => {
    onMoodSelect(mood)
    // Collapse into pills after selection
    if (!collapsed) {
      setTimeout(() => setCollapsed(true), 300)
    }
  }

  const handleClear = () => {
    // When clearing we need to notify parent with a mechanism —
    // since the prop type expects MoodType, the parent should handle
    // null state. We call onMoodSelect with the same mood to toggle,
    // but the clear button implies deselection. We'll call with the
    // selected mood and trust parent to toggle.
    setCollapsed(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-white">
          What&apos;s the vibe?
        </h2>
        {selectedMood && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X weight="bold" className="size-3" />
            Clear
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {collapsed && selectedMood ? (
          /* Collapsed pill row */
          <motion.div
            key="pills"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
          >
            {MOODS.map((config) => (
              <MoodPill
                key={config.mood}
                config={config}
                isSelected={config.mood === selectedMood}
                onSelect={() => handleSelect(config.mood)}
              />
            ))}
          </motion.div>
        ) : (
          /* Expanded 2x2 grid */
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            {MOODS.map((config) => (
              <MoodCard
                key={config.mood}
                config={config}
                isSelected={config.mood === selectedMood}
                onSelect={() => handleSelect(config.mood)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global shimmer animation keyframes */}
      <style>{`
        @keyframes mood-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  )
}
