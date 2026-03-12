import { Quotes } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'

interface VenueNarrativeCardProps {
  narrative: string
  venueName: string
  category?: string
}

export function VenueNarrativeCard({
  narrative,
  venueName,
  category,
}: VenueNarrativeCardProps) {
  return (
    <Card className="relative overflow-hidden border-border/40 bg-card/60">
      {/* Gradient background with shimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/8 via-transparent to-purple-500/6" />
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
        style={{ width: '50%' }}
      />

      <div className="relative p-4 flex flex-col gap-3">
        {/* Quotation mark */}
        <Quotes
          size={28}
          weight="fill"
          className="text-accent/30"
        />

        {/* Narrative text with fade transition */}
        <AnimatePresence mode="wait">
          <motion.p
            key={narrative}
            className="text-sm leading-relaxed text-foreground/90 italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            {narrative}
          </motion.p>
        </AnimatePresence>

        {/* Venue attribution */}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs font-semibold text-foreground">{venueName}</span>
          {category && (
            <>
              <span className="text-muted-foreground text-xs">·</span>
              <span className="text-[11px] text-muted-foreground">{category}</span>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
