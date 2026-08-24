import type { SignalEntry } from '@/lib/signal-insights'
import { localDayKey } from '@/lib/signal-windows'

export type ReminderPermission = 'prompt' | 'granted' | 'denied' | 'unsupported'

export function parseReminderTime(value: string | undefined): { hours: number; minutes: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? '')
  if (!match) return { hours: 9, minutes: 0 }
  return { hours: Number(match[1]), minutes: Number(match[2]) }
}

export function hasLoggedOnDay(entries: SignalEntry[], dayKey: string): boolean {
  return entries.some((entry) => (entry.dayKey ?? localDayKey(new Date(entry.createdAt))) === dayKey)
}

export function msUntilReminder(now: Date, reminderTime: string): number {
  const { hours, minutes } = parseReminderTime(reminderTime)
  const next = new Date(now)
  next.setHours(hours, minutes, 0, 0)
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return next.getTime() - now.getTime()
}

export function shouldSendReminder(input: {
  enabled: boolean
  reminderTime: string
  timezone?: string | null
  entries: Array<{ dayKey?: string; createdAt: string }>
  now: Date
  windowMinutes?: number
}): boolean {
  if (!input.enabled) return false
  const dayKey = localDayKey(input.now)
  if (hasLoggedOnDay(input.entries as SignalEntry[], dayKey)) return false

  const { hours, minutes } = parseReminderTime(input.reminderTime)
  const scheduled = new Date(input.now)
  scheduled.setHours(hours, minutes, 0, 0)
  const windowMs = (input.windowMinutes ?? 15) * 60 * 1000
  const elapsed = input.now.getTime() - scheduled.getTime()
  return elapsed >= 0 && elapsed < windowMs
}

export function reminderCopy(permission: ReminderPermission, hasVapid: boolean): string {
  if (permission === 'unsupported') return 'This browser cannot show notifications. We will nudge you in the app instead.'
  if (permission === 'denied') return 'Notifications are blocked. Enable them in the browser, or keep the in-app nudge.'
  if (!hasVapid) return 'In-app reminder is on. Closed-app push needs a production VAPID key.'
  if (permission === 'granted') return 'We will remind you at the chosen time, including when the app is closed.'
  return 'Turn on to request notification permission.'
}

export function resolveReminderPermission(notification: { permission?: string } | undefined): ReminderPermission {
  if (!notification || typeof notification.permission !== 'string') return 'unsupported'
  if (notification.permission === 'granted') return 'granted'
  if (notification.permission === 'denied') return 'denied'
  return 'prompt'
}
