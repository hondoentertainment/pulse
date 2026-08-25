import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { Bell, CalendarBlank, ChartLine, CheckCircle, Gear, House, Lightning, TrendDown, TrendUp } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { fetchSignalEntries } from '@/lib/signal-data'
import { hasSupabaseConfig } from '@/lib/supabase'
import { requestPushPermission } from '@/lib/pwa'
import { buildChartSeries, calculateSignalMetrics, compareMorningEvening, generateInsight, getOpenWindow, getTodayEntries, resolveEntryWindow, type TrendDirection } from '@/lib/signal-insights'
import { windowLabel } from '@/lib/signal-windows'
import { GOAL_OPTIONS, TRACKING_OPTIONS, useSignalStore } from '@/stores/use-signal-store'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { useHaptics } from '@/hooks/use-haptics'
import { useSignalReminder } from '@/hooks/use-signal-reminder'
import { PilotSignupCard } from '@/components/signal/PilotSignupCard'
import { SignalCheckIn } from '@/components/signal/SignalCheckIn'
import { SignalChart } from '@/components/signal/SignalChart'
import { SignalOnboarding } from '@/components/signal/SignalOnboarding'
import { FirstWinDialog } from '@/components/signal/FirstWinDialog'
import { SignalPageTransition } from '@/components/signal/SignalPageTransition'
import { SignalSyncSkeleton } from '@/components/signal/SignalSyncSkeleton'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

const navItems = [
  { to: '/home', label: 'Home', icon: House, description: 'Today\'s check-in' },
  { to: '/trends', label: 'Trends', icon: ChartLine, description: 'Chart and pattern' },
  { to: '/history', label: 'History', icon: CalendarBlank, description: 'Daily log' },
  { to: '/settings', label: 'Settings', icon: Gear, description: 'Preferences' },
]

function Shell({ children, inertChrome }: { children: ReactNode; inertChrome?: boolean }) {
  const location = useLocation()
  const { triggerLight } = useHaptics()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    trackEvent({ type: 'signal_nav', timestamp: Date.now(), to: location.pathname })
  }, [location.pathname])

  return (
    <main className="min-h-dvh bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))] text-foreground [background-image:radial-gradient(circle_at_20%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_32rem),radial-gradient(circle_at_85%_10%,color-mix(in_oklch,var(--accent)_14%,transparent),transparent_28rem)]">
      <div
        className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5"
        {...(inertChrome ? { inert: true } : {})}
      >
        {children}
      </div>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/90 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl"
        aria-label="Primary"
        {...(inertChrome ? { inert: true } : {})}
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={`${item.label} — ${item.description}`}
                onClick={() => triggerLight()}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-bold transition-colors touch-manipulation tap-highlight-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  active ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {active && (
                  <motion.span
                    layoutId={reduceMotion ? undefined : 'signal-nav-pill'}
                    className="absolute inset-0 rounded-2xl bg-primary shadow-lg shadow-primary/20"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    aria-hidden
                  />
                )}
                <span className="relative z-10 flex flex-col items-center">
                  <Icon size={20} weight={active ? 'fill' : 'bold'} />
                  <span className="mt-1">{item.label}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </main>
  )
}

function formatTrendDirection(direction: TrendDirection): string {
  if (direction === 'up') return 'Up'
  if (direction === 'down') return 'Down'
  return 'Steady'
}

function TrendIcon({ direction }: { direction: TrendDirection }) {
  if (direction === 'up') return <TrendUp size={22} weight="bold" className="text-emerald-400" />
  if (direction === 'down') return <TrendDown size={22} weight="bold" className="text-amber-300" />
  return <Lightning size={22} weight="fill" className="text-primary" />
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-4xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function greetingLabel() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function HomePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const { triggerSuccess } = useHaptics()
  const [saving, setSaving] = useState(false)
  const profile = useSignalStore((state) => state.profile)
  const entries = useSignalStore((state) => state.entries)
  const saveEntry = useSignalStore((state) => state.saveEntry)
  const savedAt = useSignalStore((state) => state.savedAt)
  const reminder = useSignalReminder()
  const metrics = useMemo(() => calculateSignalMetrics(entries, profile), [entries, profile])
  const todayEntries = getTodayEntries(entries)
  const openWindow = getOpenWindow(entries)
  const morning = todayEntries.find((entry) => resolveEntryWindow(entry) === 'morning')
  const evening = todayEntries.find((entry) => resolveEntryWindow(entry) === 'evening')

  const focusLabel = profile ? TRACKING_OPTIONS.find((o) => o.id === profile.trackingFocus)?.label : null
  const goalShort = profile ? GOAL_OPTIONS.find((o) => o.id === profile.goal)?.label : null
  const contextLine =
    focusLabel && goalShort ? `${focusLabel} · ${goalShort}` : 'Your daily signal'

  const handleSave = () => {
    setSaving(true)
    const wasFirst = entries.length === 0
    const saved = saveEntry(userId)
    const score = saved.score
    const scoreBucket: 'low' | 'mid' | 'high' = score < 40 ? 'low' : score < 70 ? 'mid' : 'high'
    trackEvent({ type: 'signal_check_in_saved', timestamp: Date.now(), isFirstEntry: wasFirst, scoreBucket })
    triggerSuccess()
    toast.success('Saved', { description: `${windowLabel(resolveEntryWindow(saved))} signal is now part of your trend.` })
    setSaving(false)
  }

  return (
    <SignalPageTransition>
    <div className="space-y-4">
      <section className="pt-1">
        <p className="text-sm font-medium text-muted-foreground">{greetingLabel()}</p>
        <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight sm:text-3xl">Today</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{contextLine}</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Streak" value={metrics.streakCount} detail={metrics.streakCount === 1 ? 'day active' : 'days active'} />
        <MetricCard label="7-day avg" value={metrics.sevenDayAverage || '--'} detail="signal score" />
      </div>

      <section className="rounded-[2rem] border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TrendIcon direction={metrics.trendDirection} />
          </span>
          <div>
            <p className="text-sm font-bold text-primary">Insight</p>
            <p className="mt-1 text-lg font-black leading-6">{generateInsight(entries, profile)}</p>
            <p className="mt-3 text-sm text-muted-foreground">{metrics.recommendation}</p>
          </div>
        </div>
      </section>

      {reminder.nudge && openWindow && (
        <section className="rounded-[1.75rem] border border-primary/30 bg-primary/10 p-4">
          <p className="font-black">Time for today’s signal</p>
          <p className="mt-1 text-sm text-muted-foreground">Your reminder window is open. Log this {windowLabel(openWindow).toLowerCase()} check-in.</p>
          <Button variant="ghost" className="mt-2 h-10 px-0 text-primary" onClick={reminder.dismissNudge}>
            Dismiss
          </Button>
        </section>
      )}

      {(morning || evening) && (
        <section className="grid grid-cols-2 gap-3">
          <MetricCard label="Morning" value={morning ? morning.score : '--'} detail={morning ? 'logged' : 'open until noon'} />
          <MetricCard label="Evening" value={evening ? evening.score : '--'} detail={evening ? 'logged' : morning ? 'ready when you are' : 'after noon'} />
        </section>
      )}

      {openWindow ? (
        <SignalCheckIn onSave={handleSave} saving={saving} />
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-emerald-500/35 bg-emerald-500/10 p-5 text-emerald-50"
        >
          <div className="flex items-center gap-3">
            <CheckCircle size={28} weight="fill" className="text-emerald-400" />
            <div>
              <p className="font-black">Today is logged</p>
              <p className="text-sm text-emerald-200/90">
                {morning && evening
                  ? `Morning ${morning.score} · Evening ${evening.score}. Come back tomorrow.`
                  : `Score ${todayEntries[0]?.score ?? '--'}. The next window opens later today.`}
              </p>
            </div>
          </div>
          <Button variant="secondary" className="mt-4 w-full rounded-2xl" onClick={() => navigate('/trends')}>
            View trend
          </Button>
        </motion.section>
      )}

      {savedAt && <p className="text-center text-xs text-muted-foreground">Last saved {new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
    </div>
    </SignalPageTransition>
  )
}

function TrendsPage() {
  const profile = useSignalStore((state) => state.profile)
  const entries = useSignalStore((state) => state.entries)
  const metrics = useMemo(() => calculateSignalMetrics(entries, profile), [entries, profile])
  const amPm = useMemo(() => compareMorningEvening(entries), [entries])

  return (
    <SignalPageTransition>
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-primary">Trends</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Your state over time.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Chart and pattern — see how your signal moves across the week.</p>
      </div>
      <SignalChart data={buildChartSeries(entries)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Average" value={metrics.sevenDayAverage || '--'} detail="last 7 days" />
        <MetricCard label="Direction" value={formatTrendDirection(metrics.trendDirection)} detail="current pattern" />
        <MetricCard label="Streak" value={metrics.streakCount} detail="daily loop" />
      </div>
      {amPm.morning !== null && amPm.evening !== null && (
        <section className="rounded-[2rem] border border-border bg-card p-5">
          <p className="text-sm font-bold text-primary">Morning vs evening</p>
          <p className="mt-2 text-xl font-black leading-7">
            Morning avg {amPm.morning} · Evening avg {amPm.evening}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {amPm.delta === 0
              ? 'Your mornings and evenings land in the same range.'
              : amPm.delta && amPm.delta > 0
                ? `Evenings run ${amPm.delta} points higher than mornings.`
                : `Mornings run ${Math.abs(amPm.delta ?? 0)} points higher than evenings.`}
          </p>
        </section>
      )}
      <section className="rounded-[2rem] border border-border bg-card p-5">
        <p className="text-sm font-bold text-primary">Recommendation</p>
        <p className="mt-2 text-xl font-black leading-7">{metrics.recommendation}</p>
      </section>
    </div>
    </SignalPageTransition>
  )
}

function HistoryPage() {
  const navigate = useNavigate()
  const entries = useSignalStore((state) => state.entries)

  return (
    <SignalPageTransition>
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-primary">History</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Past signals.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Daily log — every check-in you&apos;ve saved, newest first.</p>
      </div>
      <div className="space-y-3">
        {entries.length === 0 && (
          <div className="rounded-[2rem] border border-dashed border-border bg-card p-8 text-center">
            <p className="font-black">No entries yet</p>
            <p className="mt-2 text-sm text-muted-foreground">Your first check-in will appear here.</p>
            <Button className="mt-6 w-full rounded-2xl" onClick={() => navigate('/home')}>
              Log today&apos;s signal
            </Button>
          </div>
        )}
        {entries.map((entry, index) => (
          <motion.article
            key={entry.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            className="rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black">{new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                <p className="text-sm text-muted-foreground">
                  {windowLabel(resolveEntryWindow(entry))} · {entry.tags.join(', ') || 'daily signal'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">{entry.score}</p>
                <p className="text-xs text-muted-foreground">score</p>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
    </SignalPageTransition>
  )
}

function SettingsPage() {
  const { signOut, user, session } = useSupabaseAuth()
  const profile = useSignalStore((state) => state.profile)
  const reminderEnabled = useSignalStore((state) => state.reminderEnabled)
  const setReminder = useSignalStore((state) => state.setReminder)
  const reminder = useSignalReminder()
  const researchUrl = import.meta.env.VITE_RESEARCH_FEEDBACK_URL as string | undefined
  const reminderTime = profile?.reminderTime ?? '09:00'

  const handleReminder = async (checked: boolean) => {
    if (checked) {
      const subscription = await requestPushPermission()
      if (subscription && session?.access_token) {
        await fetch('/api/signal/push-subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
            userAgent: navigator.userAgent,
          }),
        }).catch(() => undefined)
      }
    }
    setReminder(checked, reminderTime, user?.id)
    trackEvent({
      type: 'signal_reminder_toggle',
      timestamp: Date.now(),
      enabled: checked,
      permission: reminder.permission,
    })
  }

  return (
    <SignalPageTransition>
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-primary">Settings</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Keep the loop simple.</h1>
      </div>
      <PilotSignupCard />
      <section className="space-y-3 rounded-[2rem] border border-border bg-card p-5">
        <p className="font-black">Research</p>
        <p className="text-sm text-muted-foreground">
          {researchUrl
            ? 'Book a short call or survey — it helps us prioritize what to build.'
            : 'Add VITE_RESEARCH_FEEDBACK_URL (survey or Calendly) to surface a link here.'}
        </p>
        {researchUrl ? (
          <Button
            variant="outline"
            className="h-12 w-full rounded-2xl"
            onClick={() => {
              trackEvent({ type: 'signal_research_cta_click', timestamp: Date.now(), target: 'feedback' })
              window.open(researchUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            Share feedback
          </Button>
        ) : null}
      </section>
      <section className="rounded-[2rem] border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell size={22} weight="fill" />
            </span>
            <div>
              <p className="font-black">Daily reminder</p>
              <p className="text-sm text-muted-foreground">
                {reminderTime} local time
              </p>
            </div>
          </div>
          <Switch checked={reminderEnabled} onCheckedChange={(checked) => void handleReminder(checked)} />
        </div>
        {reminderEnabled && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold" htmlFor="reminder-time">Reminder time</label>
            <input
              id="reminder-time"
              type="time"
              value={reminderTime}
              onChange={(event) => setReminder(true, event.target.value, user?.id)}
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base"
            />
            <p className="rounded-2xl bg-primary/10 p-3 text-sm text-primary">{reminder.copy}</p>
          </div>
        )}
      </section>
      <Button variant="outline" className="h-12 w-full touch-manipulation rounded-2xl" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
    </SignalPageTransition>
  )
}

function SignalRoutes() {
  const { user } = useSupabaseAuth()
  const userId = user?.id ?? 'local-user'
  const profile = useSignalStore((state) => state.profile)
  const entries = useSignalStore((state) => state.entries)
  const mergeRemoteEntries = useSignalStore((state) => state.mergeRemoteEntries)
  const firstWinOpen = useSignalStore((state) => state.firstWinOpen)
  const closeFirstWin = useSignalStore((state) => state.closeFirstWin)

  const remoteEntries = useQuery({
    queryKey: ['signal-entries', userId],
    queryFn: () => fetchSignalEntries(userId),
    enabled: Boolean(userId),
    retry: 1,
  })

  useEffect(() => {
    if (remoteEntries.data) mergeRemoteEntries(remoteEntries.data)
  }, [mergeRemoteEntries, remoteEntries.data])

  const finishOnboarding = () => {
    toast.success('First signal saved', { description: 'Your baseline, insight, and streak are ready.' })
  }

  return (
    <>
      {!profile && <SignalOnboarding userId={userId} onFinished={finishOnboarding} />}
      <Shell inertChrome={!profile}>
        {hasSupabaseConfig && remoteEntries.isError && (
          <div
            className="mb-4 rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-foreground"
            role="status"
          >
            <p className="font-bold text-destructive">Couldn&apos;t sync history</p>
            <p className="mt-1 text-muted-foreground">Your entries on this device are unchanged.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-xl"
              onClick={() => {
                trackEvent({ type: 'signal_sync_retry', timestamp: Date.now() })
                void remoteEntries.refetch()
              }}
            >
              Retry sync
            </Button>
          </div>
        )}
        {hasSupabaseConfig && remoteEntries.isPending && !remoteEntries.isFetched && (
          <SignalSyncSkeleton />
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage userId={userId} />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        <FirstWinDialog open={firstWinOpen} entries={entries} profile={profile} onClose={closeFirstWin} />
      </Shell>
    </>
  )
}

export function SignalApp() {
  useEffect(() => {
    trackEvent({ type: 'signal_app_shell_mount', timestamp: Date.now(), path: '/signal' })
  }, [])

  return (
    <BrowserRouter>
      <SignalRoutes />
    </BrowserRouter>
  )
}
