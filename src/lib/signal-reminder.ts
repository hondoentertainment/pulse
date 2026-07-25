/**
 * Daily check-in reminders.
 *
 * Settings previously showed a toggle labelled "push notifications coming
 * soon" — it stored a preference and did nothing else, so the daily habit loop
 * had no nudge at all.
 *
 * ## Scope, honestly
 *
 * A web app cannot reliably wake itself at an arbitrary future time once fully
 * closed; that needs server-sent push (a real VAPID key + a backend scheduler —
 * `requestPushPermission` in `pwa.ts` still carries a placeholder dev key) or
 * the not-yet-broadly-available Notification Triggers API. What *does* work
 * today, and is what this module implements:
 *
 *   1. A real OS notification fired at the chosen local time while the app is
 *      open or its tab/service worker is still alive.
 *   2. A reliable in-app nudge shown on next open when the reminder time has
 *      passed and today has no check-in.
 *
 * (2) is the dependable half and is what keeps the streak honest. The pure
 * helpers below are unit-tested; the browser plumbing is a thin wrapper.
 */
import type { SignalEntry } from '@/lib/signal-insights'
import { getTodayEntry } from '@/lib/signal-insights'

/** Default reminder time when the user enables reminders without choosing one. */
export const DEFAULT_REMINDER_TIME = '09:00'

export type ReminderPermission = 'unsupported' | 'default' | 'granted' | 'denied'

/** Parse an 'HH:MM' string into hours/minutes. Returns null when malformed. */
export function parseReminderTime(value: string): { hours: number; minutes: number } | null {
  const match = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(value)
  if (!match) return null
  return { hours: Number(match[1]), minutes: Number(match[2]) }
}

/**
 * Milliseconds from `now` until the next occurrence of the given local time.
 * When the time has already passed today, the next occurrence is tomorrow.
 * Returns null for a malformed time.
 */
export function msUntilNextReminder(time: string, now: Date = new Date()): number | null {
  const parsed = parseReminderTime(time)
  if (!parsed) return null

  const next = new Date(now)
  next.setHours(parsed.hours, parsed.minutes, 0, 0)
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return next.getTime() - now.getTime()
}

/**
 * Whether the reminder time has already passed today (local wall clock).
 * Malformed times are treated as "not yet due".
 */
export function isReminderDue(time: string, now: Date = new Date()): boolean {
  const parsed = parseReminderTime(time)
  if (!parsed) return false
  const due = new Date(now)
  due.setHours(parsed.hours, parsed.minutes, 0, 0)
  return now.getTime() >= due.getTime()
}

/**
 * Whether to show the "you haven't checked in yet" nudge: reminders on, the
 * time has passed today, and there is no entry for today.
 */
export function shouldNudgeForCheckIn(
  entries: SignalEntry[],
  options: { enabled: boolean; reminderTime: string },
  now: Date = new Date(),
): boolean {
  if (!options.enabled) return false
  if (!isReminderDue(options.reminderTime, now)) return false
  return getTodayEntry(entries, now) === null
}

/** Copy for the reminder notification. Kept here so it can be asserted in tests. */
export const REMINDER_NOTIFICATION = {
  title: 'How are you doing today?',
  body: 'Take 10 seconds to log your signal and keep your streak alive.',
} as const

// ---------------------------------------------------------------------------
// Browser plumbing (thin, guarded)
// ---------------------------------------------------------------------------

/** Current notification permission, or 'unsupported' outside a capable browser. */
export function getReminderPermission(): ReminderPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as ReminderPermission
}

/** Prompt for notification permission. Resolves to the resulting state. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  try {
    return (await Notification.requestPermission()) as ReminderPermission
  } catch {
    return 'denied'
  }
}

/**
 * Fire the reminder notification now. Prefers the service-worker registration
 * (required on Android/Chrome) and falls back to a page-level Notification.
 * No-ops without permission.
 */
export async function fireReminderNotification(): Promise<boolean> {
  if (getReminderPermission() !== 'granted') return false

  const options: NotificationOptions = {
    body: REMINDER_NOTIFICATION.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'signal-daily-reminder',
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(REMINDER_NOTIFICATION.title, options)
      return true
    }
    new Notification(REMINDER_NOTIFICATION.title, options)
    return true
  } catch {
    return false
  }
}
