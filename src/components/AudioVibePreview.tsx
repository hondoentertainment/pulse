import { motion } from 'framer-motion'
import { Play, Pause, SpeakerSimpleHigh, SpeakerSimpleLow, SpeakerSimpleNone, SpeakerSimpleSlash } from '@phosphor-icons/react'
import type { VolumeLevel } from '@/lib/venue-storytelling'

interface AudioVibePreviewProps {
  genre: string
  ambiance: string
  volumeLevel: VolumeLevel
  isPlaying?: boolean
  onToggle?: () => void
}

const GENRE_COLORS: Record<string, string> = {
  'Electronic': 'oklch(0.65 0.28 340)',    // purple
  'House':      'oklch(0.65 0.28 340)',
  'Jazz':       'oklch(0.72 0.16 85)',      // warm gold
  'Classical':  'oklch(0.72 0.16 85)',
  'Rock':       'oklch(0.60 0.22 25)',      // red
  'Pop':        'oklch(0.70 0.20 350)',     // pink
  'Hip-Hop':    'oklch(0.60 0.22 25)',
  'Indie':      'oklch(0.60 0.15 150)',     // teal/green
  'Folk':       'oklch(0.65 0.14 100)',     // warm green
  'Lo-fi':      'oklch(0.55 0.12 260)',     // muted blue
  'Soul':       'oklch(0.65 0.18 50)',      // warm orange
  'Ambient':    'oklch(0.55 0.10 240)',     // cool blue
  'R&B':        'oklch(0.60 0.20 320)',     // magenta
}

function getGenreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? 'oklch(0.60 0.15 240)'
}

const VOLUME_ICONS: Record<VolumeLevel, typeof SpeakerSimpleHigh> = {
  quiet: SpeakerSimpleNone,
  moderate: SpeakerSimpleLow,
  loud: SpeakerSimpleHigh,
  thumping: SpeakerSimpleHigh,
}

const VOLUME_LABELS: Record<VolumeLevel, string> = {
  quiet: 'Quiet',
  moderate: 'Moderate',
  loud: 'Loud',
  thumping: 'Thumping',
}

const BAR_COUNT = 16

function WaveformBars({ isPlaying, color }: { isPlaying: boolean; color: string }) {
  return (
    <div className="flex items-end gap-[2px] h-6">
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        // Base heights vary to create a waveform shape
        const baseHeight = 0.3 + Math.sin((i / BAR_COUNT) * Math.PI) * 0.5
        const minH = 3
        const maxH = 22

        return (
          <motion.div
            key={i}
            className="w-[3px] rounded-full"
            style={{ backgroundColor: color }}
            animate={
              isPlaying
                ? {
                    height: [
                      minH + baseHeight * (maxH - minH),
                      minH + (baseHeight * 0.3 + 0.7 * Math.random()) * (maxH - minH),
                      minH + baseHeight * (maxH - minH),
                    ],
                    opacity: [0.6, 1, 0.6],
                  }
                : {
                    height: minH + baseHeight * 4,
                    opacity: 0.3,
                  }
            }
            transition={
              isPlaying
                ? {
                    duration: 0.4 + Math.random() * 0.4,
                    repeat: Infinity,
                    repeatType: 'mirror' as const,
                    ease: 'easeInOut',
                    delay: i * 0.04,
                  }
                : { duration: 0.5 }
            }
          />
        )
      })}
    </div>
  )
}

export function AudioVibePreview({
  genre,
  ambiance,
  volumeLevel,
  isPlaying = false,
  onToggle,
}: AudioVibePreviewProps) {
  const color = getGenreColor(genre)
  const VolumeIcon = VOLUME_ICONS[volumeLevel]

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-3">
      {/* Play/pause button */}
      <motion.button
        type="button"
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={onToggle}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause size={16} weight="fill" style={{ color }} />
        ) : (
          <Play size={16} weight="fill" style={{ color }} />
        )}
      </motion.button>

      {/* Waveform + labels */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color }}
          >
            {genre}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <VolumeIcon size={10} weight="fill" />
            {VOLUME_LABELS[volumeLevel]}
          </span>
        </div>

        <WaveformBars isPlaying={isPlaying} color={color} />

        <p className="text-[10px] text-muted-foreground truncate">{ambiance}</p>
      </div>
    </div>
  )
}
