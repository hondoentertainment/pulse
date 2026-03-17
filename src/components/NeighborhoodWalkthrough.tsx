import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  NavigationArrow,
  Play,
  Check,
  X,
  MusicNote,
  Wine,
  ForkKnife,
  Fire,
  Star,
  Beer,
} from '@phosphor-icons/react'
import type { WalkthroughRoute, WalkthroughTheme } from '@/lib/neighborhood-walkthrough'

interface NeighborhoodWalkthroughProps {
  route: WalkthroughRoute | null
  currentStopIndex: number
  isActive: boolean
  isCompleted: boolean
  estimatedCompletion: Date | null
  availableThemes: WalkthroughTheme[]
  onGenerateRoute: (neighborhood: string, theme?: WalkthroughTheme) => void
  onStart: () => void
  onAdvance: () => void
  onEnd: () => void
  neighborhood: string
}

const THEME_CONFIG: Record<WalkthroughTheme, { label: string; icon: typeof Fire }> = {
  'hottest': { label: 'Hottest', icon: Fire },
  'cocktail-crawl': { label: 'Cocktails', icon: Wine },
  'dive-bars': { label: 'Dive Bars', icon: Beer },
  'live-music': { label: 'Live Music', icon: MusicNote },
  'foodie': { label: 'Foodie', icon: ForkKnife },
  'best-of': { label: 'Best Of', icon: Star },
}

export function NeighborhoodWalkthrough({
  route,
  currentStopIndex,
  isActive,
  isCompleted,
  estimatedCompletion,
  availableThemes,
  onGenerateRoute,
  onStart,
  onAdvance,
  onEnd,
  neighborhood,
}: NeighborhoodWalkthroughProps) {
  const [selectedTheme, setSelectedTheme] = useState<WalkthroughTheme>('hottest')

  const handleThemeSelect = (theme: WalkthroughTheme) => {
    setSelectedTheme(theme)
    onGenerateRoute(neighborhood, theme)
  }

  // Completed state
  if (isCompleted && route) {
    const totalStops = route.stops.length
    const totalTimeMinutes = route.totalWalkTime + totalStops * 30
    const hours = Math.floor(totalTimeMinutes / 60)
    const mins = totalTimeMinutes % 60
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 p-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20"
        >
          <Check size={32} weight="bold" className="text-green-400" />
        </motion.div>
        <h3 className="text-lg font-bold text-white mb-1">Crawl complete!</h3>
        <p className="text-sm text-white/60">
          You hit {totalStops} spots in {timeStr}
        </p>
        <button
          onClick={onEnd}
          className="mt-4 rounded-xl bg-white/10 px-6 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors"
        >
          Done
        </button>
      </motion.div>
    )
  }

  // In-progress top bar
  if (isActive && route) {
    const currentStop = route.stops[currentStopIndex]
    const nextStop = route.stops[currentStopIndex + 1]
    const isLastStop = currentStopIndex >= route.stops.length - 1

    return (
      <div className="space-y-4">
        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/10 border border-purple-500/30 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <NavigationArrow size={18} weight="fill" className="text-purple-400" />
              <span className="text-sm font-semibold text-white">
                Stop {currentStopIndex + 1} of {route.stops.length}
              </span>
            </div>
            <button
              onClick={onEnd}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/20 transition-colors"
            >
              <X size={14} />
              End
            </button>
          </div>

          {currentStop && (
            <div className="mb-3">
              <h4 className="font-bold text-white">{currentStop.venue.name}</h4>
              <p className="text-xs text-white/50">{currentStop.venue.location.address}</p>
            </div>
          )}

          {nextStop && !isLastStop && (
            <p className="text-xs text-white/40 mb-3">
              {nextStop.walkTimeFromPrevious} min walk to {nextStop.venue.name}
            </p>
          )}

          {estimatedCompletion && (
            <p className="text-xs text-white/30 mb-3">
              ETA: {estimatedCompletion.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}

          <button
            onClick={onAdvance}
            className="w-full rounded-xl bg-purple-500 py-2.5 text-sm font-semibold text-white hover:bg-purple-400 transition-colors"
          >
            {isLastStop ? 'Finish Crawl' : 'Next Stop'}
          </button>
        </motion.div>

        {/* Stop list */}
        <div className="space-y-1">
          {route.stops.map((stop, idx) => {
            const isVisited = idx < currentStopIndex
            const isCurrent = idx === currentStopIndex

            return (
              <motion.div
                key={stop.venue.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-3"
              >
                {/* Number circle + connecting line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      isVisited
                        ? 'bg-green-500/30 text-green-400'
                        : isCurrent
                          ? 'bg-purple-500 text-white animate-pulse'
                          : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {isVisited ? <Check size={14} weight="bold" /> : stop.order}
                  </div>
                  {idx < route.stops.length - 1 && (
                    <div className="h-6 w-px border-l border-dashed border-white/20" />
                  )}
                </div>

                {/* Stop info */}
                <div className={`flex-1 ${isVisited ? 'opacity-50' : ''}`}>
                  <p className={`text-sm font-medium ${isCurrent ? 'text-white' : 'text-white/70'}`}>
                    {stop.venue.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    {stop.walkTimeFromPrevious > 0 && (
                      <span>{stop.walkTimeFromPrevious} min walk</span>
                    )}
                    <span className="capitalize">{stop.energyAtArrival}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    )
  }

  // Default state: theme selector + route card
  return (
    <div className="space-y-4">
      {/* Theme selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist">
        {availableThemes.map((theme) => {
          const config = THEME_CONFIG[theme]
          const Icon = config.icon
          const isSelected = selectedTheme === theme

          return (
            <button
              key={theme}
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleThemeSelect(theme)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              <Icon size={16} weight={isSelected ? 'fill' : 'regular'} />
              {config.label}
            </button>
          )
        })}
      </div>

      {/* Route card */}
      <AnimatePresence mode="wait">
        {route && (
          <motion.div
            key={route.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-2xl bg-gradient-to-br from-purple-500/15 to-pink-500/10 border border-white/10 p-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {THEME_CONFIG[route.theme as WalkthroughTheme]?.label ?? route.theme} Route
                </h3>
                <p className="text-sm text-white/50 mt-0.5">
                  {route.venueCount} stops &middot; {route.totalWalkTime} min walking &middot;{' '}
                  {route.totalDistance.toFixed(1)} mi
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  route.difficulty === 'easy'
                    ? 'bg-green-500/20 text-green-400'
                    : route.difficulty === 'moderate'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                }`}
              >
                {route.difficulty}
              </span>
            </div>

            {/* Stop list */}
            <div className="space-y-1 mb-5">
              {route.stops.map((stop, idx) => (
                <motion.div
                  key={stop.venue.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/70">
                      {stop.order}
                    </div>
                    {idx < route.stops.length - 1 && (
                      <div className="h-5 w-px border-l border-dashed border-white/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{stop.venue.name}</p>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      {stop.walkTimeFromPrevious > 0 && (
                        <span>{stop.walkTimeFromPrevious} min walk</span>
                      )}
                      <span className="capitalize">{stop.energyAtArrival}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-white/30">
                      {stop.estimatedArrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Start CTA */}
            <button
              onClick={onStart}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 py-3 text-sm font-semibold text-white hover:bg-purple-400 transition-colors"
            >
              <Play size={18} weight="fill" />
              Start Route
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!route && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-white/20 p-8 text-center"
        >
          <MapPin size={32} weight="duotone" className="mx-auto mb-3 text-white/30" />
          <p className="text-sm text-white/40">
            Select a theme to generate a walkthrough route
          </p>
        </motion.div>
      )}
    </div>
  )
}
