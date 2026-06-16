import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { BatteryHigh, Brain, Moon, Smiley, Sparkle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useSignalStore } from '@/stores/use-signal-store'

interface SignalCheckInProps {
  onSave: () => void
  compact?: boolean
}

const TAGS = ['calm', 'clear', 'tired', 'stressed', 'social', 'active']

function MetricSlider({
  label,
  value,
  onChange,
  icon,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  icon: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
          <span className="font-semibold">{label}</span>
        </div>
        <span className="text-2xl font-black tabular-nums">{value}</span>
      </div>
      <Slider value={[value]} min={1} max={10} step={1} onValueChange={([next]) => onChange(next)} aria-label={label} />
    </div>
  )
}

export function SignalCheckIn({ onSave, compact = false }: SignalCheckInProps) {
  const draft = useSignalStore((state) => state.draft)
  const updateDraft = useSignalStore((state) => state.updateDraft)

  const toggleTag = (tag: string) => {
    updateDraft({
      tags: draft.tags.includes(tag)
        ? draft.tags.filter((item) => item !== tag)
        : [...draft.tags, tag].slice(0, 3),
    })
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

      <div className="grid gap-3">
        <MetricSlider label="Energy" value={draft.energy} onChange={(energy) => updateDraft({ energy })} icon={<BatteryHigh size={18} weight="fill" />} />
        <MetricSlider label="Mood" value={draft.mood} onChange={(mood) => updateDraft({ mood })} icon={<Smiley size={18} weight="fill" />} />
        <MetricSlider label="Stress" value={draft.stress} onChange={(stress) => updateDraft({ stress })} icon={<Brain size={18} weight="fill" />} />
        <MetricSlider label="Sleep" value={draft.sleepQuality} onChange={(sleepQuality) => updateDraft({ sleepQuality })} icon={<Moon size={18} weight="fill" />} />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">Quick context</p>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                'min-h-10 rounded-full border px-4 text-sm font-semibold transition-all active:scale-95',
                draft.tags.includes(tag)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-secondary',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <Button size="lg" className="mt-5 h-14 w-full rounded-2xl text-base font-black" onClick={onSave}>
        <Sparkle size={20} weight="fill" className="mr-2" />
        Save today&apos;s signal
      </Button>
    </motion.section>
  )
}
