import { useCallback, useEffect, useRef } from 'react'
import { Fire, TrendUp, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { generateInsight, buildChartSeries, calculateSignalMetrics, type SignalEntry, type SignalProfile } from '@/lib/signal-insights'
import { SignalChart } from '@/components/signal/SignalChart'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

interface FirstWinDialogProps {
  open: boolean
  entries: SignalEntry[]
  profile: SignalProfile | null
  onClose: () => void
}

export function FirstWinDialog({ open, entries, profile, onClose }: FirstWinDialogProps) {
  const metrics = calculateSignalMetrics(entries, profile)
  const dismissedRef = useRef(false)

  useEffect(() => {
    if (open) {
      dismissedRef.current = false
      trackEvent({ type: 'signal_first_win_open', timestamp: Date.now() })
    }
  }, [open])

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    trackEvent({ type: 'signal_first_win_dismiss', timestamp: Date.now() })
    onClose()
  }, [onClose])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent
        className={cn(
          'flex max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem))] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(90dvh,44rem)]',
          'rounded-[2rem] border shadow-2xl',
          'max-sm:top-auto max-sm:right-0 max-sm:bottom-0 max-sm:left-0 max-sm:max-w-[100vw] max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[2rem] max-sm:pt-[env(safe-area-inset-top,0px)]',
          '[&>button.absolute]:hidden',
        )}
      >
        <DialogTitle className="sr-only">First win unlocked — your baseline is live</DialogTitle>
        <DialogDescription id="first-win-description" className="sr-only">
          Review your first signal streak, direction, and seven-day chart.
        </DialogDescription>

        <div className="shrink-0 pt-3 sm:pt-4">
          <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted" aria-hidden />
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
            <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={dismiss} aria-label="Close">
              <X size={18} />
            </Button>
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

          <Button className="mt-5 h-12 w-full rounded-2xl text-base font-black" onClick={dismiss}>
            See my dashboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
