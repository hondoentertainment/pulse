import { motion, useReducedMotion } from 'framer-motion'
import { useMemo, useState, type ReactNode } from 'react'
import { BatteryHigh, Brain, Moon, Plus, Smiley, Sparkle, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useHaptics } from '@/hooks/use-haptics'
import { computeDraftScore, scoreBucket, scoreBucketColor, scoreBucketLabel } from '@/lib/signal-score'
import { cn } from '@/lib/utils'
import { useSignalStore } from '@/stores/use-signal-store'
import { getAvailableTags, getTagsFromHistory, isBuiltInTag, MAX_TAGS_PER_ENTRY, MAX_CUSTOM_TAGS, MAX_TAG_LENGTH } from '@/lib/signal-tags'

interface SignalCheckInProps {
  onSave: () => void
  compact?: boolean
  saving?: boolean
}

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
  const customTags = useSignalStore((state) => state.customTags)
  const addCustomTag = useSignalStore((state) => state.addCustomTag)
  const removeCustomTag = useSignalStore((state) => state.removeCustomTag)
  const { triggerSelection, triggerSuccess } = useHaptics()

  const [adding, setAdding] = useState(false)
  const [newTag, setNewTag] = useState('')
  const entries = useSignalStore((state) => state.entries)
  const availableTags = useMemo(
    () => getAvailableTags(customTags, getTagsFromHistory(entries)),
    [customTags, entries],
  )

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
        : [...draft.tags, tag].slice(0, MAX_TAGS_PER_ENTRY),
    })
  }

  /** Add a custom tag and select it immediately — adding implies intent to use. */
  const commitNewTag = () => {
    const added = addCustomTag(newTag)
    if (added) {
      triggerSelection()
      if (!draft.tags.includes(added)) {
        updateDraft({ tags: [...draft.tags, added].slice(0, MAX_TAGS_PER_ENTRY) })
      }
    }
    setNewTag('')
    setAdding(false)
  }

  const handleRemoveCustomTag = (tag: string) => {
    removeCustomTag(tag)
    // Drop it from the in-progress draft too, so a deleted tag can't be saved.
    if (draft.tags.includes(tag)) {
      updateDraft({ tags: draft.tags.filter((item) => item !== tag) })
    }
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
        <p className="mb-2 text-sm font-semibold">
          Quick context{' '}
          <span className="font-normal text-muted-foreground">(up to {MAX_TAGS_PER_ENTRY})</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const selected = draft.tags.includes(tag)
            const removable = !isBuiltInTag(tag)
            return (
              <span key={tag} className="relative inline-flex">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'min-h-11 rounded-full border px-4 text-sm font-semibold transition-all touch-manipulation tap-highlight-none active:scale-95',
                    removable && 'pr-9',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'border-border bg-background text-foreground hover:bg-secondary',
                  )}
                >
                  {tag}
                </button>
                {removable && (
                  <button
                    type="button"
                    aria-label={`Remove ${tag} tag`}
                    onClick={() => handleRemoveCustomTag(tag)}
                    className={cn(
                      'absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors',
                      selected
                        ? 'text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <X size={13} weight="bold" />
                  </button>
                )}
              </span>
            )
          })}

          {adding ? (
            <input
              autoFocus
              type="text"
              value={newTag}
              maxLength={MAX_TAG_LENGTH}
              aria-label="New tag name"
              placeholder="gym, coffee…"
              onChange={(event) => setNewTag(event.target.value)}
              onBlur={commitNewTag}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitNewTag()
                } else if (event.key === 'Escape') {
                  setNewTag('')
                  setAdding(false)
                }
              }}
              className="min-h-11 w-36 rounded-full border border-primary bg-background px-4 text-sm font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            customTags.length < MAX_CUSTOM_TAGS && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                aria-label="Add a custom tag"
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border px-4 text-sm font-semibold text-muted-foreground transition-colors touch-manipulation tap-highlight-none hover:bg-secondary hover:text-foreground active:scale-95"
              >
                <Plus size={14} weight="bold" />
                Add
              </button>
            )
          )}
        </div>
        {availableTags.length > 6 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your own tags make the pattern insights sharper — track what actually moves your day.
          </p>
        )}
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
