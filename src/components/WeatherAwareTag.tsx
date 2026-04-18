import type { WeatherVenueTag } from '@/lib/contextual-intelligence'
import type { WeatherCondition } from '@/lib/contextual-intelligence'
import {
  Sun,
  CloudRain,
  Snowflake,
  ThermometerHot,
  House,
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeatherAwareTagProps {
  weatherTag: WeatherVenueTag
  conditions: WeatherCondition
}

// ---------------------------------------------------------------------------
// Style / icon mapping
// ---------------------------------------------------------------------------

type TagStyle = {
  icon: typeof Sun
  className: string
}

function getTagStyle(
  tag: WeatherVenueTag,
  conditions: WeatherCondition,
): TagStyle {
  // Indoor during bad weather -> blue cozy
  if (tag.type === 'indoor' && (conditions === 'rain' || conditions === 'snow')) {
    return {
      icon: House,
      className: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    }
  }

  // Indoor during hot weather -> cool escape
  if (tag.type === 'indoor' && conditions === 'hot') {
    return {
      icon: House,
      className: 'bg-sky-400/15 text-sky-400 border-sky-400/20',
    }
  }

  // Outdoor/patio/rooftop in clear weather -> warm orange
  if (
    (tag.type === 'outdoor' || tag.type === 'patio' || tag.type === 'rooftop') &&
    conditions === 'clear'
  ) {
    return {
      icon: Sun,
      className: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    }
  }

  // Outdoor in rain -> rain icon, muted/warning
  if (
    (tag.type === 'outdoor' || tag.type === 'patio' || tag.type === 'rooftop') &&
    conditions === 'rain'
  ) {
    return {
      icon: CloudRain,
      className: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    }
  }

  // Outdoor in snow
  if (
    (tag.type === 'outdoor' || tag.type === 'patio' || tag.type === 'rooftop') &&
    conditions === 'snow'
  ) {
    return {
      icon: Snowflake,
      className: 'bg-sky-300/15 text-sky-300 border-sky-300/20',
    }
  }

  // Outdoor in hot weather
  if (
    (tag.type === 'outdoor' || tag.type === 'patio') &&
    conditions === 'hot'
  ) {
    return {
      icon: ThermometerHot,
      className: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    }
  }

  // Rooftop in hot weather -> breezy
  if (tag.type === 'rooftop' && conditions === 'hot') {
    return {
      icon: Sun,
      className: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    }
  }

  // Default: neutral indoor
  return {
    icon: House,
    className: 'bg-muted/40 text-muted-foreground border-border/40',
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact pill tag for venue cards showing indoor/outdoor/patio/rooftop
 * status with a weather-appropriate icon and color coding.
 */
export function WeatherAwareTag({ weatherTag, conditions }: WeatherAwareTagProps) {
  const { icon: Icon, className } = getTagStyle(weatherTag, conditions)

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        text-[10px] font-medium border whitespace-nowrap
        ${className}
      `}
    >
      <Icon size={11} weight="fill" />
      {weatherTag.label}
    </motion.span>
  )
}
