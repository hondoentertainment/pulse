import { parseReminderTime } from '../../src/lib/signal-reminder'

export interface ReminderCandidate {
  userId: string
  reminderTime: string
  timezone?: string | null
  dayKey: string
}

export interface ReminderProfileRow {
  user_id: string
  reminder_enabled: boolean
  reminder_time: string | null
  reminder_timezone?: string | null
}

export interface ReminderEntryRow {
  user_id: string
  day_key: string
}

function zonedParts(now: Date, timezone?: string | null): { dayKey: string; minutes: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]))
    const dayKey = `${parts.year}-${parts.month}-${parts.day}`
    const minutes = Number(parts.hour) * 60 + Number(parts.minute)
    if (!Number.isFinite(minutes)) return null
    return { dayKey, minutes }
  } catch {
    return null
  }
}

export function selectReminderRecipients(input: {
  profiles: ReminderProfileRow[]
  logged: ReminderEntryRow[]
  now: Date
  windowMinutes?: number
}): ReminderCandidate[] {
  const loggedKeys = new Set(input.logged.map((row) => `${row.user_id}:${row.day_key}`))
  const windowMinutes = input.windowMinutes ?? 15
  const recipients: ReminderCandidate[] = []

  for (const profile of input.profiles) {
    if (!profile.reminder_enabled || !profile.reminder_time) continue
    const zoned = zonedParts(input.now, profile.reminder_timezone)
    if (!zoned) continue
    if (loggedKeys.has(`${profile.user_id}:${zoned.dayKey}`)) continue

    const parsed = parseReminderTime(profile.reminder_time)
    const scheduledMinutes = parsed.hours * 60 + parsed.minutes
    const elapsed = zoned.minutes - scheduledMinutes
    if (elapsed >= 0 && elapsed < windowMinutes) {
      recipients.push({
        userId: profile.user_id,
        reminderTime: profile.reminder_time,
        timezone: profile.reminder_timezone,
        dayKey: zoned.dayKey,
      })
    }
  }

  return recipients
}
