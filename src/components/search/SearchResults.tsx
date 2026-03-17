import { motion, type Variants } from 'framer-motion'
import { MapPin, Buildings, TrendUp, MagnifyingGlass } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string
  type: 'venue' | 'city' | 'category'
  label: string
  sublabel?: string
  venueId?: string
  cityKey?: string
  /** Indices of matched characters inside `label` (for highlighting). */
  matchRanges: [number, number][]
}

export type ResultSection = {
  key: string
  title: string
  icon: React.ReactNode
  results: SearchResult[]
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HighlightedText({
  text,
  ranges,
}: {
  text: string
  ranges: [number, number][]
}) {
  if (ranges.length === 0) return <>{text}</>

  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const [start, end] of ranges) {
    if (start > cursor) {
      parts.push(
        <span key={`t-${cursor}`}>{text.slice(cursor, start)}</span>,
      )
    }
    parts.push(
      <span
        key={`h-${start}`}
        className="text-accent font-bold"
      >
        {text.slice(start, end)}
      </span>,
    )
    cursor = end
  }

  if (cursor < text.length) {
    parts.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>)
  }

  return <>{parts}</>
}

// ---------------------------------------------------------------------------
// Motion variants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SearchResults
// ---------------------------------------------------------------------------

interface SearchResultsProps {
  sections: ResultSection[]
  activeIndex: number
  onSelect: (result: SearchResult) => void
  onHover: (globalIndex: number) => void
}

export function SearchResults({
  sections,
  activeIndex,
  onSelect,
  onHover,
}: SearchResultsProps) {
  let globalIndex = 0

  return (
    <div className="space-y-5">
      {sections.map((section, sectionIdx) => {
        const sectionStartIndex = globalIndex
        const sectionElement = (
          <motion.div
            key={section.key}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            custom={sectionIdx}
          >
            <div className="flex items-center gap-2 mb-2">
              {section.icon}
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </h3>
              <span className="text-xs text-muted-foreground/60 ml-1">
                {section.results.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.results.map((result, i) => {
                const resultGlobalIndex = sectionStartIndex + i
                const isActive = resultGlobalIndex === activeIndex

                return (
                  <motion.button
                    key={result.id}
                    data-result-index={resultGlobalIndex}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    custom={i}
                    onClick={() => onSelect(result)}
                    onMouseEnter={() => onHover(resultGlobalIndex)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                      'text-left transition-colors duration-100',
                      isActive
                        ? 'bg-accent/10 ring-1 ring-accent/20'
                        : 'hover:bg-card/80',
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        result.type === 'venue' &&
                          'bg-gradient-to-br from-primary/20 to-accent/20',
                        result.type === 'city' &&
                          'bg-gradient-to-br from-blue-500/20 to-cyan-500/20',
                        result.type === 'category' &&
                          'bg-gradient-to-br from-purple-500/20 to-pink-500/20',
                      )}
                    >
                      {result.type === 'venue' && (
                        <MapPin
                          size={16}
                          weight="fill"
                          className="text-accent"
                        />
                      )}
                      {result.type === 'city' && (
                        <Buildings
                          size={16}
                          weight="fill"
                          className="text-blue-400"
                        />
                      )}
                      {result.type === 'category' && (
                        <TrendUp
                          size={16}
                          weight="fill"
                          className="text-purple-400"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        <HighlightedText
                          text={result.label}
                          ranges={result.matchRanges}
                        />
                      </p>
                      {result.sublabel && (
                        <p className="text-xs text-muted-foreground truncate">
                          {result.sublabel}
                        </p>
                      )}
                    </div>
                    {result.type === 'venue' && (
                      <div className="flex-shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">
                          Venue
                        </span>
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )

        globalIndex += section.results.length
        return sectionElement
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NoResults
// ---------------------------------------------------------------------------

interface NoResultsProps {
  query: string
}

export function NoResults({ query }: NoResultsProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="w-16 h-16 rounded-2xl bg-card/80 flex items-center justify-center mb-4">
        <MagnifyingGlass
          size={32}
          weight="duotone"
          className="text-muted-foreground"
        />
      </div>
      <p className="text-base font-semibold text-foreground mb-1">
        No results for &ldquo;{query}&rdquo;
      </p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Try a different spelling, or search for a city or category
        like &ldquo;rooftop&rdquo; or &ldquo;Brooklyn&rdquo;
      </p>
    </motion.div>
  )
}
