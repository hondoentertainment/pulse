import { useEffect, useRef } from 'react'
import {
  fireReminderNotification,
  getReminderPermission,
  msUntilNextReminder,
} from '@/lib/signal-reminder'
import { getTodayEntry } from '@/lib/signal-insights'
import type { SignalEntry } from '@/lib/signal-insights'

/**
 * Schedules the daily check-in notification while the app is alive.
 *
 * Fires at the user's local reminder time, skips days already logged, then
 * re-arms for the next day. This covers the "app is open or backgrounded"
 * case; the on-open nudge in `shouldNudgeForCheckIn` covers the rest. True
 * fire-when-closed delivery needs server push (see signal-reminder.ts).
 */
export function useSignalReminder(options: {
  enabled: boolean
  reminderTime: string
  entries: SignalEntry[]
}): void {
  const { enabled, reminderTime } = options
  // Held in a ref so re-renders from new entries don't reschedule the timer.
  const entriesRef = useRef(options.entries)
  entriesRef.current = options.entries

  useEffect(() => {
    if (!enabled) return
    if (getReminderPermission() !== 'granted') return

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const schedule = () => {
      const delay = msUntilNextReminder(reminderTime)
      if (delay === null) return

      timeoutId = setTimeout(() => {
        if (cancelled) return
        // Don't nag on a day that's already logged.
        if (getTodayEntry(entriesRef.current) === null) {
          void fireReminderNotification()
        }
        schedule()
      }, delay)
    }

    schedule()

    return () => {
      cancelled = true
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [enabled, reminderTime])
}
