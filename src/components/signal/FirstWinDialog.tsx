import { motion, AnimatePresence } from 'framer-motion'
import { Fire, TrendUp, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { generateInsight, buildChartSeries, calculateSignalMetrics, type SignalEntry, type SignalProfile } from '@/lib/signal-insights'
import { SignalChart } from '@/components/signal/SignalChart'

interface FirstWinDialogProps {
  open: boolean
  entries: SignalEntry[]
  profile: SignalProfile | null
  onClose: () => void
}

export function FirstWinDialog({ open, entries, profile, onClose }: FirstWinDialogProps) {
  const metrics = calculateSignalMetrics(entries, profile)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 pt-8 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.section
            initial={{ y: 48, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 48, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="flex max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem))] w-full max-w-lg flex-col rounded-[2rem] border border-border bg-background shadow-2xl sm:max-h-[min(90dvh,44rem)]"
          >
            <div className="shrink-0 pt-3 sm:pt-4">
              <div
                className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted"
                aria-hidden
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2 sm:px-6 sm:pb-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Fire size={24} weight="fill" />
                  </div>
                  <p className="text-sm font-bold text-primary">First win unlocked</p>
                  <h2 className="text-3xl font-black tracking-tight">Your baseline is live.</h2>
                </div>
                <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-secondary shrink-0">
                  <X size={18} />
                  <span className="sr-only">Close</span>
                </button>
              </div>

              <div className="mb-4 rounded-3xl bg-primary/10 p-4">
                <p className="text-sm font-semibold leading-6">{generateInsight(entries, profile)}</p>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Streak</p>
                  <p className="mt-1 text-4xl font-black">{Math.max(metrics.streakCount, 1)}</p>
                  <p className="text-xs text-muted-foreground">day started</p>
                </div>
                <div className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Direction</p>
                  <div className="mt-2 flex items-center gap-2">
                    <TrendUp size={28} weight="bold" className="text-primary" />
                    <p className="text-lg font-black">Baseline</p>
                  </div>
                  <p className="text-xs text-muted-foreground">trend begins now</p>
                </div>
              </div>

              <SignalChart data={buildChartSeries(entries)} />

              <Button className="mt-5 h-12 w-full rounded-2xl text-base font-black" onClick={onClose}>
                See my dashboard
              </Button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
