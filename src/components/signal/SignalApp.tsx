import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { Bell, CalendarBlank, ChartLine, CheckCircle, Gear, House, Lightning, TrendDown, TrendUp } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { fetchSignalEntries, fetchAllSignalEntries, fetchSignalProfile, deleteAllSignalData } from '@/lib/signal-data'
import { hasSupabaseConfig } from '@/lib/supabase'
import { buildChartSeries, calculateSignalMetrics, generateInsight, getTodayEntry, type SignalEntry, type TrendDirection } from '@/lib/signal-insights'
import { GOAL_OPTIONS, TRACKING_OPTIONS, useSignalStore } from '@/stores/use-signal-store'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { useHaptics } from '@/hooks/use-haptics'
import { SignalCheckIn } from '@/components/signal/SignalCheckIn'
import { SignalChart } from '@/components/signal/SignalChart'
import { SignalPatterns } from '@/components/signal/SignalPatterns'
import { SignalWeeklySummary } from '@/components/signal/SignalWeeklySummary'
import { downloadSignalCsv } from '@/lib/signal-export'
import { getPersonalizedAdvice } from '@/lib/signal-advice'
import { backfillTimestamp, getMostRecentMissedDay, getStreakDetail } from '@/lib/signal-streak'
import {
  DEFAULT_REMINDER_TIME,
  getReminderPermission,
  parseReminderTime,
  requestReminderPermission,
  shouldNudgeForCheckIn,
  type ReminderPermission,
} from '@/lib/signal-reminder'
import { useSignalReminder } from '@/hooks/use-signal-reminder'
import { isValidEmail, submitPilotSignup } from '@/lib/signal-pilot'
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
  const [backfillDay, setBackfillDay] = useState<Date | null>(null)
  const profile = useSignalStore((state) => state.profile)
  const entries = useSignalStore((state) => state.entries)
  const saveEntry = useSignalStore((state) => state.saveEntry)
  const savedAt = useSignalStore((state) => state.savedAt)
  const reminderEnabled = useSignalStore((state) => state.reminderEnabled)
  const metrics = useMemo(() => calculateSignalMetrics(entries, profile), [entries, profile])
  const advice = useMemo(() => getPersonalizedAdvice(entries, profile), [entries, profile])
  const streak = useMemo(() => getStreakDetail(entries), [entries])
  const missedDay = useMemo(() => getMostRecentMissedDay(entries), [entries])
  const todayEntry = getTodayEntry(entries)
  const nudge = shouldNudgeForCheckIn(entries, {
    enabled: reminderEnabled,
    reminderTime: profile?.reminderTime ?? DEFAULT_REMINDER_TIME,
  })

  const focusLabel = profile ? TRACKING_OPTIONS.find((o) => o.id === profile.trackingFocus)?.label : null
  const goalShort = profile ? GOAL_OPTIONS.find((o) => o.id === profile.goal)?.label : null
  const contextLine =
    focusLabel && goalShort ? `${focusLabel} · ${goalShort}` : 'Your daily signal'

  const handleSave = () => {
    setSaving(true)
    const wasFirst = entries.length === 0
    const backfilling = backfillDay !== null
    // Use the returned entry: entries are sorted by createdAt, so after a
    // backfill entries[0] is the newest normal check-in, not the one just saved.
    const savedEntry = saveEntry(
      userId,
      undefined,
      backfilling ? backfillTimestamp(backfillDay) : undefined,
    )
    const score = savedEntry.score
    const scoreBucket: 'low' | 'mid' | 'high' = score < 40 ? 'low' : score < 70 ? 'mid' : 'high'
    trackEvent({ type: 'signal_check_in_saved', timestamp: Date.now(), isFirstEntry: wasFirst, scoreBucket })
    triggerSuccess()
    toast.success(backfilling ? 'Gap filled' : 'Saved', {
      description: backfilling
        ? `${backfillDay.toLocaleDateString(undefined, { weekday: 'long' })} is now part of your trend.`
        : 'Your daily signal is now part of your trend.',
    })
    setBackfillDay(null)
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
        <MetricCard
          label="Streak"
          value={metrics.streakCount}
          detail={streak.graceUsed ? 'days · 1 grace used' : metrics.streakCount === 1 ? 'day active' : 'days active'}
        />
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
            <p className="mt-3 text-sm text-muted-foreground">{advice.text}</p>
          </div>
        </div>
      </section>

      {nudge && (
        <div
          className="flex items-center gap-3 rounded-[1.75rem] border border-primary/30 bg-primary/10 px-4 py-3"
          role="status"
        >
          <Bell size={20} weight="fill" className="shrink-0 text-primary" />
          <p className="text-sm font-bold text-primary">
            Your {profile?.reminderTime ?? DEFAULT_REMINDER_TIME} check-in is still open — it only takes 10 seconds.
          </p>
        </div>
      )}

      {backfillDay ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-[1.75rem] border border-primary/30 bg-primary/10 px-4 py-3">
            <p className="text-sm font-bold text-primary">
              Filling in {backfillDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setBackfillDay(null)}>
              Cancel
            </Button>
          </div>
          <SignalCheckIn onSave={handleSave} saving={saving} />
        </div>
      ) : todayEntry ? (
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
        <SignalCheckIn onSave={handleSave} saving={saving} />
      )}

      {!backfillDay && missedDay && (
        <button
          type="button"
          onClick={() => setBackfillDay(missedDay)}
          className="flex w-full items-center justify-between gap-3 rounded-[1.75rem] border border-dashed border-border bg-card px-4 py-3 text-left transition-colors hover:bg-secondary"
        >
          <span>
            <span className="block text-sm font-black">
              You missed {missedDay.toLocaleDateString(undefined, { weekday: 'long' })}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Fill it in to keep your history complete.
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-primary">Log it</span>
        </button>
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
  const advice = useMemo(() => getPersonalizedAdvice(entries, profile), [entries, profile])

  return (
    <SignalPageTransition>
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-primary">Trends</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Your state over time.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Chart and pattern — see how your signal moves across the week.</p>
      </div>
      <SignalWeeklySummary entries={entries} />
      <SignalChart data={buildChartSeries(entries)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Average" value={metrics.sevenDayAverage || '--'} detail="last 7 days" />
        <MetricCard label="Direction" value={formatTrendDirection(metrics.trendDirection)} detail="current pattern" />
        <MetricCard label="Streak" value={metrics.streakCount} detail="daily loop" />
      </div>
      <section className="rounded-[2rem] border border-border bg-card p-5">
        <p className="text-sm font-bold text-primary">
          {advice.source === 'pattern' ? 'Based on your data' : 'Recommendation'}
        </p>
        <p className="mt-2 text-xl font-black leading-7">{advice.text}</p>
      </section>
      <SignalPatterns entries={entries} />
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
                <p className="text-sm text-muted-foreground">{entry.tags.join(', ') || 'daily signal'}</p>
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

/** Typed confirmation required before an irreversible delete. */
const DELETE_CONFIRMATION = 'DELETE'

/**
 * Permanent deletion of a user's Signal data. Export exists, but self-serve
 * delete did not — it's required for app-store review and most privacy
 * regimes, and it's the other half of "your data is yours".
 *
 * Deliberately high-friction: an explicit typed confirmation, because this
 * cannot be undone.
 */
function DangerZone({ userId, entryCount }: { userId: string; entryCount: number }) {
  const { signOut } = useSupabaseAuth()
  const clearLocalSignalData = useSignalStore((state) => state.clearLocalSignalData)
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION) return
    setDeleting(true)
    try {
      await deleteAllSignalData(userId)
      clearLocalSignalData()
      toast.success('Your data has been deleted', {
        description: 'Every check-in and preference has been removed.',
      })
      await signOut()
    } catch (error) {
      toast.error("Couldn't delete your data", {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setDeleting(false)
      setOpen(false)
      setConfirmation('')
    }
  }

  return (
    <section className="space-y-3 rounded-[2rem] border border-destructive/35 bg-destructive/5 p-5">
      <p className="font-black text-destructive">Delete your data</p>
      <p className="text-sm text-muted-foreground">
        Permanently removes {entryCount > 0 ? `all ${entryCount} check-in${entryCount === 1 ? '' : 's'}` : 'your check-ins'},
        your profile, and your preferences. This cannot be undone — export first if you want a copy.
      </p>

      {!open ? (
        <Button
          variant="outline"
          className="h-12 w-full rounded-2xl border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          Delete everything
        </Button>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-bold" htmlFor="delete-confirm">
            Type {DELETE_CONFIRMATION} to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="h-12 w-full rounded-2xl border border-destructive/50 bg-background px-4 text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="h-12 flex-1 rounded-2xl"
              onClick={() => {
                setOpen(false)
                setConfirmation('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-12 flex-1 rounded-2xl"
              disabled={deleting || confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION}
              onClick={() => void handleDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete forever'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * Pulse Pro pilot waitlist. Captures a real email address into
 * `signal_pilot_signups` so demand is measurable and signups are contactable —
 * the CTA previously only fired a toast.
 */
function PilotSignupCard({ userId, defaultEmail }: { userId: string | null; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail)
  const [submitting, setSubmitting] = useState(false)
  const [joined, setJoined] = useState(false)

  const handleSubmit = async () => {
    trackEvent({ type: 'signal_research_cta_click', timestamp: Date.now(), target: 'pro_pilot' })

    if (!isValidEmail(email)) {
      toast.error('Check that email', { description: 'Enter a valid address so we can reach you.' })
      return
    }

    setSubmitting(true)
    try {
      const result = await submitPilotSignup({ email, userId })
      switch (result.status) {
        case 'saved':
          setJoined(true)
          toast.success("You're on the list", { description: 'We will reach out when the pilot opens.' })
          break
        case 'already_registered':
          setJoined(true)
          toast.message('Already on the list', { description: 'That address is registered for the pilot.' })
          break
        case 'unconfigured':
          toast.message('Thanks!', { description: 'Noted locally — sync is not configured in this build.' })
          break
        case 'invalid_email':
          toast.error('Check that email', { description: 'Enter a valid address so we can reach you.' })
          break
        case 'error':
          toast.error("Couldn't save that", { description: result.message })
          break
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-3 rounded-[2rem] border border-border bg-card p-5">
      <p className="font-black">Pulse Pro pilot</p>
      <p className="text-sm text-muted-foreground">
        {joined
          ? "You're on the list — we'll be in touch before the pilot opens."
          : 'We are lining up pricing and premium insights. Leave your email for early access.'}
      </p>
      {!joined && (
        <>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-label="Email for the Pulse Pro pilot"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            variant="secondary"
            className="h-12 w-full rounded-2xl"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Saving…' : 'Join the pilot list'}
          </Button>
        </>
      )}
    </section>
  )
}

/**
 * Daily reminder controls. Enabling asks for real notification permission and
 * schedules an OS notification at the chosen local time; the in-app nudge on
 * Home covers the case where the app wasn't running. See signal-reminder.ts
 * for why fire-when-fully-closed needs server push.
 */
function ReminderSettings({ userId }: { userId: string }) {
  const profile = useSignalStore((state) => state.profile)
  const reminderEnabled = useSignalStore((state) => state.reminderEnabled)
  const setReminder = useSignalStore((state) => state.setReminder)
  const [permission, setPermission] = useState<ReminderPermission>(() => getReminderPermission())

  const reminderTime = profile?.reminderTime ?? DEFAULT_REMINDER_TIME

  const handleToggle = async (checked: boolean) => {
    if (!checked) {
      setReminder(false, reminderTime, userId)
      return
    }

    let next = getReminderPermission()
    if (next === 'default') next = await requestReminderPermission()
    setPermission(next)

    if (next === 'denied') {
      setReminder(false, reminderTime, userId)
      toast.error('Notifications are blocked', {
        description: 'Allow notifications for this site in your browser settings, then try again.',
      })
      return
    }

    setReminder(true, reminderTime, userId)
    toast.success('Daily reminder on', {
      description:
        next === 'granted'
          ? `We'll nudge you at ${reminderTime}.`
          : `This browser can't show notifications, so we'll remind you inside the app at ${reminderTime}.`,
    })
  }

  const handleTimeChange = (value: string) => {
    if (!parseReminderTime(value)) return
    setReminder(reminderEnabled, value, userId)
  }

  return (
    <section className="rounded-[2rem] border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell size={22} weight="fill" />
          </span>
          <div>
            <p className="font-black">Daily reminder</p>
            <p className="text-sm text-muted-foreground">
              A once-a-day nudge to log your signal.
            </p>
          </div>
        </div>
        <Switch
          checked={reminderEnabled}
          aria-label="Daily reminder"
          onCheckedChange={(checked) => void handleToggle(checked)}
        />
      </div>

      {reminderEnabled && (
        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/40 px-4 py-3">
            <span className="text-sm font-bold">Remind me at</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(event) => handleTimeChange(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <p className="rounded-2xl bg-primary/10 p-3 text-sm text-primary">
            {permission === 'granted'
              ? `Notification set for ${reminderTime} local time. Days you've already logged are skipped.`
              : `We'll remind you inside the app at ${reminderTime}. Enable browser notifications to get nudged outside it.`}
          </p>
        </div>
      )}
    </section>
  )
}

function SettingsPage() {
  const { signOut, user } = useSupabaseAuth()
  const userId = user?.id ?? 'local-user'
  const entries = useSignalStore((state) => state.entries)
  const researchUrl = import.meta.env.VITE_RESEARCH_FEEDBACK_URL as string | undefined
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    trackEvent({ type: 'signal_export_click', timestamp: Date.now(), entryCount: entries.length })
    setExporting(true)
    try {
      // Locally-persisted entries are only the hydrated set (remote fetch caps
      // at 60). For a true "every check-in" export, pull the full history from
      // the backend when signed in and merge it with local, deduped by id.
      let full = entries
      if (hasSupabaseConfig && user?.id) {
        try {
          const remote = await fetchAllSignalEntries(user.id)
          if (remote.length > 0) {
            const byId = new Map<string, SignalEntry>()
            for (const entry of [...remote, ...entries]) byId.set(entry.id, entry)
            full = Array.from(byId.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
          }
        } catch {
          toast.warning('Exporting local history only', {
            description: "Couldn't reach the server — some older entries may be missing.",
          })
        }
      }

      const started = downloadSignalCsv(full)
      if (started) {
        toast.success('Export ready', { description: `${full.length} check-in${full.length === 1 ? '' : 's'} saved as CSV.` })
      } else {
        toast.error('Export unavailable', { description: 'Downloads are not supported in this environment.' })
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <SignalPageTransition>
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-primary">Settings</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Keep the loop simple.</h1>
      </div>
      <PilotSignupCard userId={user?.id ?? null} defaultEmail={user?.email ?? ''} />
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
      <ReminderSettings userId={userId} />
      <section className="space-y-3 rounded-[2rem] border border-border bg-card p-5">
        <p className="font-black">Your data</p>
        <p className="text-sm text-muted-foreground">
          {entries.length > 0
            ? 'Download every check-in as a CSV — yours to keep, analyse, or move anywhere.'
            : 'Once you log a check-in, you can export your full history as CSV here.'}
        </p>
        <Button
          variant="outline"
          className="h-12 w-full rounded-2xl"
          disabled={entries.length === 0 || exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? 'Preparing…' : 'Export as CSV'}
        </Button>
      </section>
      <DangerZone userId={userId} entryCount={entries.length} />
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
  const hydrateProfile = useSignalStore((state) => state.hydrateProfile)
  const firstWinOpen = useSignalStore((state) => state.firstWinOpen)
  const closeFirstWin = useSignalStore((state) => state.closeFirstWin)
  const reminderEnabled = useSignalStore((state) => state.reminderEnabled)

  useSignalReminder({
    enabled: reminderEnabled,
    reminderTime: profile?.reminderTime ?? DEFAULT_REMINDER_TIME,
    entries,
  })

  const remoteEntries = useQuery({
    queryKey: ['signal-entries', userId],
    queryFn: () => fetchSignalEntries(userId),
    enabled: Boolean(userId),
    retry: 1,
  })

  // Without this, a returning user on a new device has a null local profile and
  // gets pushed back through onboarding, overwriting the focus/goal/reminder
  // settings already saved server-side.
  const remoteProfile = useQuery({
    queryKey: ['signal-profile', userId],
    queryFn: () => fetchSignalProfile(userId),
    enabled: Boolean(userId) && hasSupabaseConfig,
    retry: 1,
  })

  useEffect(() => {
    if (remoteEntries.data) mergeRemoteEntries(remoteEntries.data)
  }, [mergeRemoteEntries, remoteEntries.data])

  useEffect(() => {
    if (remoteProfile.data) hydrateProfile(remoteProfile.data)
  }, [hydrateProfile, remoteProfile.data])

  // Don't decide "needs onboarding" until the saved profile has had a chance
  // to arrive, or a returning user briefly sees onboarding and can complete it.
  const profileResolved =
    !hasSupabaseConfig || !userId || remoteProfile.isFetched || remoteProfile.isError

  const finishOnboarding = () => {
    toast.success('First signal saved', { description: 'Your baseline, insight, and streak are ready.' })
  }

  return (
    <>
      {!profile && profileResolved && <SignalOnboarding userId={userId} onFinished={finishOnboarding} />}
      <Shell inertChrome={!profile && profileResolved}>
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
