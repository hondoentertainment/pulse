import { motion, useReducedMotion } from 'framer-motion'
import { useMemo, type ReactNode } from 'react'
import { BatteryHigh, Brain, Moon, Smiley, Sparkle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useHaptics } from '@/hooks/use-haptics'
import { computeDraftScore, scoreBucket, scoreBucketColor, scoreBucketLabel } from '@/lib/signal-score'
import { cn } from '@/lib/utils'
import { useSignalStore } from '@/stores/use-signal-store'

interface SignalCheckInProps {
  onSave: () => void
  compact?: boolean
  saving?: boolean
}

const TAGS = ['calm', 'clear', 'tired', 'stressed', 'social', 'active']

function MetricSlider({
  label,
  value,
  onChange,
  icon,
  onAdjust,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  icon: ReactNode
  onAdjust?: () => void
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4 touch-manipulation">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
          <span className="font-semibold">{label}</span>
        </div>
        <span className="text-2xl font-black tabular-nums">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={1}
        max={10}
        step={1}
        aria-label={`${label} level`}
        onValueChange={([next]) => {
          onChange(next)
          onAdjust?.()
        }}
      />
    </div>
  )
}

function LiveScorePreview({ score }: { score: number }) {
  const reduceMotion = useReducedMotion()
  const bucket = scoreBucket(score)
  const color = scoreBucketColor(bucket)

  return (
    <motion.div
      layout={!reduceMotion}
      className="relative overflow-hidden rounded-[1.75rem] border border-border/60 p-5"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklch, ${color} 22%, transparent), color-mix(in oklch, var(--primary) 12%, transparent))`,
      }}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live signal</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <motion.p
            key={score}
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="text-6xl font-black tabular-nums tracking-tight"
            style={{ color }}
          >
            {score}
          </motion.p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">{scoreBucketLabel(bucket)}</p>
        </div>
        <motion.div
          aria-hidden
          animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="h-16 w-16 rounded-full border-4 opacity-90"
          style={{ borderColor: color, boxShadow: `0 0 24px color-mix(in oklch, ${color} 45%, transparent)` }}
        />
      </div>
    </motion.div>
  )
}

export function SignalCheckIn({ onSave, compact = false, saving = false }: SignalCheckInProps) {
  const draft = useSignalStore((state) => state.draft)
  const updateDraft = useSignalStore((state) => state.updateDraft)
  const { triggerSelection, triggerSuccess } = useHaptics()

  const liveScore = useMemo(
    () =>
      computeDraftScore({
        energy: draft.energy,
        mood: draft.mood,
        stress: draft.stress,
        sleepQuality: draft.sleepQuality,
      }),
    [draft.energy, draft.mood, draft.stress, draft.sleepQuality],
  )

  const toggleTag = (tag: string) => {
    triggerSelection()
    updateDraft({
      tags: draft.tags.includes(tag)
        ? draft.tags.filter((item) => item !== tag)
        : [...draft.tags, tag].slice(0, 3),
    })
  }

  const handleSave = () => {
    triggerSuccess()
    onSave()
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-[2rem] border border-border/70 bg-card p-4 shadow-sm', !compact && 'space-y-4')}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">10-second check-in</p>
          <h2 className="text-2xl font-black tracking-tight">How are you right now?</h2>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">No typing</span>
      </div>

      <LiveScorePreview score={liveScore} />

      <div className="grid gap-3">
        <MetricSlider
          label="Energy"
          value={draft.energy}
          onChange={(energy) => updateDraft({ energy })}
          onAdjust={triggerSelection}
          icon={<BatteryHigh size={18} weight="fill" />}
        />
        <MetricSlider
          label="Mood"
          value={draft.mood}
          onChange={(mood) => updateDraft({ mood })}
          onAdjust={triggerSelection}
          icon={<Smiley size={18} weight="fill" />}
        />
        <MetricSlider
          label="Stress"
          value={draft.stress}
          onChange={(stress) => updateDraft({ stress })}
          onAdjust={triggerSelection}
          icon={<Brain size={18} weight="fill" />}
        />
        <MetricSlider
          label="Sleep"
          value={draft.sleepQuality}
          onChange={(sleepQuality) => updateDraft({ sleepQuality })}
          onAdjust={triggerSelection}
          icon={<Moon size={18} weight="fill" />}
        />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">Quick context <span className="font-normal text-muted-foreground">(up to 3)</span></p>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => {
            const selected = draft.tags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm font-semibold transition-all touch-manipulation tap-highlight-none active:scale-95',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'border-border bg-background text-foreground hover:bg-secondary',
                )}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>

      <Button
        size="lg"
        className="mt-5 h-14 w-full touch-manipulation rounded-2xl text-base font-black shadow-lg shadow-primary/25 active:scale-[0.98]"
        onClick={handleSave}
        disabled={saving}
        aria-busy={saving}
      >
        <Sparkle size={20} weight="fill" className="mr-2" />
        {saving ? 'Saving…' : "Save today's signal"}
      </Button>
    </motion.section>
  )
}
