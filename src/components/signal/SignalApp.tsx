import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bell, CalendarBlank, ChartLine, CheckCircle, Gear, House, Lightning, TrendDown, TrendUp } from '@phosphor-icons/react'
import { toast, Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { fetchSignalEntries } from '@/lib/signal-data'
import { hasSupabaseConfig } from '@/lib/supabase'
import { buildChartSeries, calculateSignalMetrics, generateInsight, getTodayEntry, type TrendDirection } from '@/lib/signal-insights'
import { GOAL_OPTIONS, TRACKING_OPTIONS, useSignalStore } from '@/stores/use-signal-store'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { SignalCheckIn } from '@/components/signal/SignalCheckIn'
import { SignalChart } from '@/components/signal/SignalChart'
import { SignalOnboarding } from '@/components/signal/SignalOnboarding'
import { FirstWinDialog } from '@/components/signal/FirstWinDialog'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

const navItems = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/trends', label: 'Trends', icon: ChartLine },
  { to: '/history', label: 'History', icon: CalendarBlank },
  { to: '/settings', label: 'Settings', icon: Gear },
]

function Shell({ children }: { children: ReactNode }) {
  const location = useLocation()

  useEffect(() => {
    trackEvent({ type: 'signal_nav', timestamp: Date.now(), to: location.pathname })
  }, [location.pathname])

  return (
    <main className="min-h-dvh bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))] text-foreground [background-image:radial-gradient(circle_at_20%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_32rem),radial-gradient(circle_at_85%_10%,color-mix(in_oklch,var(--accent)_14%,transparent),transparent_28rem)]">
      <div className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5">
        {children}
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/90 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-bold transition-colors',
                  active ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <Icon size={20} weight={active ? 'fill' : 'bold'} />
                <span className="mt-1">{item.label}</span>
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
  const profile = useSignalStore((state) => state.profile)
  const entries = useSignalStore((state) => state.entries)
  const saveEntry = useSignalStore((state) => state.saveEntry)
  const savedAt = useSignalStore((state) => state.savedAt)
  const metrics = useMemo(() => calculateSignalMetrics(entries, profile), [entries, profile])
  const todayEntry = getTodayEntry(entries)

  const focusLabel = profile ? TRACKING_OPTIONS.find((o) => o.id === profile.trackingFocus)?.label : null
  const goalShort = profile ? GOAL_OPTIONS.find((o) => o.id === profile.goal)?.label : null
  const contextLine =
    focusLabel && goalShort ? `${focusLabel} · ${goalShort}` : 'Your daily signal'

  const handleSave = () => {
    const wasFirst = entries.length === 0
    saveEntry(userId)
    const score = useSignalStore.getState().entries[0]?.score ?? 0
    const scoreBucket: 'low' | 'mid' | 'high' = score < 40 ? 'low' : score < 70 ? 'mid' : 'high'
    trackEvent({ type: 'signal_check_in_saved', timestamp: Date.now(), isFirstEntry: wasFirst, scoreBucket })
    toast.success('Saved', { description: 'Your daily signal is now part of your trend.' })
  }

  return (
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

      {todayEntry ? (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-emerald-500/35 bg-emerald-500/10 p-5 text-emerald-50"
        >
          <div className="flex items-center gap-3">
            <CheckCircle size={28} weight="fill" className="text-emerald-400" />
            <div>
              <p className="font-black">Today is logged</p>
              <p className="text-sm text-emerald-200/90">Score {todayEntry.score}. Come back tomorrow to keep the streak alive.</p>
            </div>
          </div>
          <Button variant="secondary" className="mt-4 w-full rounded-2xl" onClick={() => navigate('/trends')}>
            View trend
          </Button>
        </motion.section>
      ) : (
        <SignalCheckIn onSave={handleSave} />
      )}

      {savedAt && <p className="text-center text-xs text-muted-foreground">Last saved {new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
    </div>
  )
}

function TrendsPage() {
  const profile = useSignalStore((state) => state.profile)
  const entries = useSignalStore((state) => state.entries)
  const metrics = useMemo(() => calculateSignalMetrics(entries, profile), [entries, profile])

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-primary">Trends</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Your state over time.</h1>
      </div>
      <SignalChart data={buildChartSeries(entries)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Average" value={metrics.sevenDayAverage || '--'} detail="last 7 days" />
        <MetricCard label="Direction" value={formatTrendDirection(metrics.trendDirection)} detail="current pattern" />
        <MetricCard label="Streak" value={metrics.streakCount} detail="daily loop" />
      </div>
      <section className="rounded-[2rem] border border-border bg-card p-5">
        <p className="text-sm font-bold text-primary">Recommendation</p>
        <p className="mt-2 text-xl font-black leading-7">{metrics.recommendation}</p>
      </section>
    </div>
  )
}

function HistoryPage() {
  const navigate = useNavigate()
  const entries = useSignalStore((state) => state.entries)

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-primary">History</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Past signals.</h1>
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
        {entries.map((entry) => (
          <article key={entry.id} className="rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black">{new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                <p className="text-sm text-muted-foreground">{entry.tags.join(', ') || 'daily signal'}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">{entry.score}</p>
                <p className="text-xs text-muted-foreground">score</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function SettingsPage() {
  const { signOut } = useSupabaseAuth()
  const profile = useSignalStore((state) => state.profile)
  const reminderEnabled = useSignalStore((state) => state.reminderEnabled)
  const setReminder = useSignalStore((state) => state.setReminder)
  const researchUrl = import.meta.env.VITE_RESEARCH_FEEDBACK_URL as string | undefined

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-primary">Settings</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Keep the loop simple.</h1>
      </div>
      <section className="space-y-3 rounded-[2rem] border border-border bg-card p-5">
        <p className="font-black">Pulse Pro pilot</p>
        <p className="text-sm text-muted-foreground">
          We are lining up pricing and premium insights. Raise your hand if you want early access.
        </p>
        <Button
          variant="secondary"
          className="h-12 w-full rounded-2xl"
          onClick={() => {
            trackEvent({ type: 'signal_research_cta_click', timestamp: Date.now(), target: 'pro_pilot' })
            toast.message('Thanks!', { description: 'We will reach out when the pilot opens.' })
          }}
        >
          Join the pilot list
        </Button>
      </section>
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
              <p className="text-sm text-muted-foreground">{profile?.reminderTime ?? '09:00'} local time</p>
            </div>
          </div>
          <Switch checked={reminderEnabled} onCheckedChange={(checked) => setReminder(checked, profile?.reminderTime ?? '09:00')} />
        </div>
        {reminderEnabled && (
          <p className="mt-4 rounded-2xl bg-primary/10 p-3 text-sm text-primary">
            Reminder preference saved. Browser push can be connected later without changing the daily habit flow.
          </p>
        )}
      </section>
      <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
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
    <Shell>
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
        <p className="mb-3 text-center text-xs text-muted-foreground" aria-live="polite">
          Syncing history…
        </p>
      )}
      {!profile && <SignalOnboarding userId={userId} onFinished={finishOnboarding} />}
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
  )
}

export function SignalApp() {
  useEffect(() => {
    trackEvent({ type: 'signal_app_shell_mount', timestamp: Date.now(), path: '/signal' })
  }, [])

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <SignalRoutes />
    </BrowserRouter>
  )
}
