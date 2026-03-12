import { getAdaptiveLayout, type WeatherCondition } from '@/lib/contextual-intelligence'
import { getTimeOfDay, getDayType } from '@/lib/time-contextual-scoring'
import { Badge } from '@/components/ui/badge'
import {
  Sun,
  CloudRain,
  Snowflake,
  ThermometerHot,
} from '@phosphor-icons/react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdaptiveHomeHeaderProps {
  /** Current user display name for personalized greeting */
  username?: string
  /** Current weather conditions, if available */
  weather?: WeatherCondition
  /** Override date for testing */
  date?: Date
  /** Callback when user taps the primary category chip */
  onCategoryTap?: (category: string) => void
}

// ---------------------------------------------------------------------------
// Weather config
// ---------------------------------------------------------------------------

const WEATHER_CONFIG: Record<
  WeatherCondition,
  { icon: typeof Sun; label: string; className: string }
> = {
  clear: {
    icon: Sun,
    label: 'Clear skies',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  },
  rain: {
    icon: CloudRain,
    label: 'Rainy',
    className: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  },
  snow: {
    icon: Snowflake,
    label: 'Snowy',
    className: 'bg-sky-300/15 text-sky-300 border-sky-300/20',
  },
  hot: {
    icon: ThermometerHot,
    label: 'Hot',
    className: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dynamic header for the home/trending screen that adapts its greeting,
 * primary category chip, tagline, and weather indicator based on time of
 * day and current conditions.
 */
export function AdaptiveHomeHeader({
  username,
  weather,
  date,
  onCategoryTap,
}: AdaptiveHomeHeaderProps) {
  const now = date ?? new Date()
  const timeOfDay = getTimeOfDay(now)
  const dayType = getDayType(now)
  const layout = getAdaptiveLayout(timeOfDay, dayType)

  const weatherInfo = weather ? WEATHER_CONFIG[weather] : null

  return (
    <LayoutGroup>
      <motion.div
        layout
        className="space-y-3 px-1"
      >
        {/* Greeting + weather */}
        <div className="flex items-center justify-between">
          <motion.h1
            key={layout.greeting}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-2xl font-bold text-foreground"
          >
            {layout.greeting}
            {username ? `, ${username}` : ''}
          </motion.h1>

          <AnimatePresence mode="wait">
            {weatherInfo && (
              <motion.div
                key={weather}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25 }}
              >
                <Badge
                  variant="outline"
                  className={`inline-flex items-center gap-1 text-[10px] font-medium border ${weatherInfo.className}`}
                >
                  <weatherInfo.icon size={12} weight="fill" />
                  {weatherInfo.label}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tagline */}
        <AnimatePresence mode="wait">
          <motion.p
            key={layout.tagline}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-muted-foreground"
          >
            {layout.tagline}
          </motion.p>
        </AnimatePresence>

        {/* Category chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <motion.button
            layout
            whileTap={{ scale: 0.95 }}
            onClick={() => onCategoryTap?.(layout.primaryCategory)}
            className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold
              bg-accent/20 text-accent border border-accent/30
              hover:bg-accent/30 transition-colors"
          >
            {layout.primaryCategory}
          </motion.button>

          {layout.secondaryCategories.map((cat) => (
            <motion.button
              key={cat}
              layout
              whileTap={{ scale: 0.95 }}
              onClick={() => onCategoryTap?.(cat)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium
                bg-muted/30 text-muted-foreground border border-border/40
                hover:bg-muted/50 transition-colors"
            >
              {cat}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </LayoutGroup>
  )
}
