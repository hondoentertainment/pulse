import { motion, type Variants } from 'framer-motion'
import { Clock, TrendUp } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Venue } from '@/lib/types'

const sectionVariants: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' },
  }),
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.2, ease: 'easeOut' },
  }),
}

interface RecentSearch {
  label: string
  type: 'venue' | 'city' | 'category'
  id: string
}

interface SearchSuggestionsProps {
  recentSearches: RecentSearch[]
  trendingVenues: Venue[]
  onSelectRecent: (recent: RecentSearch) => void
  onSelectTrending: (venue: Venue) => void
}

export function SearchSuggestions({
  recentSearches,
  trendingVenues,
  onSelectRecent,
  onSelectTrending,
}: SearchSuggestionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1, duration: 0.25 }}
    >
      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <motion.div
          className="mb-6"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock
              size={16}
              weight="fill"
              className="text-muted-foreground"
            />
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Recent Searches
            </h3>
          </div>
          <div className="space-y-1">
            {recentSearches.map((recent, i) => (
              <motion.button
                key={recent.id}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={i}
                onClick={() => onSelectRecent(recent)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                  'text-left transition-colors',
                  'hover:bg-card/80',
                )}
              >
                <Clock
                  size={18}
                  weight="regular"
                  className="text-muted-foreground flex-shrink-0"
                />
                <span className="text-sm font-medium text-foreground truncate">
                  {recent.label}
                </span>
                <span className="text-xs text-muted-foreground capitalize ml-auto flex-shrink-0">
                  {recent.type}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Trending */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        custom={recentSearches.length > 0 ? 1 : 0}
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendUp
            size={16}
            weight="fill"
            className="text-accent"
          />
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Trending Now
          </h3>
        </div>
        <div className="space-y-1">
          {trendingVenues.map((venue, i) => (
            <motion.button
              key={venue.id}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              custom={i}
              onClick={() => onSelectTrending(venue)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                'text-left transition-colors',
                'hover:bg-card/80',
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                <TrendUp
                  size={16}
                  weight="fill"
                  className="text-accent"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {venue.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[venue.category, venue.city]
                    .filter(Boolean)
                    .join(' \u00B7 ')}
                </p>
              </div>
              <div className="flex-shrink-0 text-xs font-bold text-accent tabular-nums">
                {venue.pulseScore}
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
