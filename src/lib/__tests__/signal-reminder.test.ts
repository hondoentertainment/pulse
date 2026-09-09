import { describe, expect, it } from 'vitest'
import { isReminderSnoozed, msUntilReminder, reminderCopy, shouldSendReminder, snoozeReminderUntilTomorrow } from '@/lib/signal-reminder'

describe('signal-reminder', () => {
  it('skips when today is already logged', () => {
    const now = new Date(2026, 7, 16, 9, 5)
    expect(shouldSendReminder({
      enabled: true,
      reminderTime: '09:00',
      entries: [{ dayKey: '2026-08-16', createdAt: now.toISOString() }],
      now,
    })).toBe(false)
  })

  it('sends inside the reminder window when unlogged', () => {
    const now = new Date(2026, 7, 16, 9, 5)
    expect(shouldSendReminder({
      enabled: true,
      reminderTime: '09:00',
      entries: [],
      now,
    })).toBe(true)
  })

  it('does not send before the chosen time', () => {
    const now = new Date(2026, 7, 16, 8, 59)
    expect(shouldSendReminder({
      enabled: true,
      reminderTime: '09:00',
      entries: [],
      now,
    })).toBe(false)
  })

  it('computes delay to the next local reminder', () => {
    const now = new Date(2026, 7, 16, 8, 0, 0)
    expect(msUntilReminder(now, '09:00')).toBe(60 * 60 * 1000)
  })

  it('is honest about permission and missing VAPID', () => {
    expect(reminderCopy('denied', true)).toMatch(/blocked/i)
    expect(reminderCopy('granted', false)).toMatch(/VAPID/i)
    expect(reminderCopy('unsupported', false)).toMatch(/cannot show notifications/i)
    expect(reminderCopy('granted', true)).toMatch(/closed/i)
  })
})


describe('reminder snooze', () => {
  it('suppresses sending while snoozed and clears after the stamp', () => {
    const now = new Date(2026, 7, 16, 9, 5)
    const until = snoozeReminderUntilTomorrow(now)
    expect(isReminderSnoozed(until, now)).toBe(true)
    expect(shouldSendReminder({
      enabled: true,
      reminderTime: '09:00',
      entries: [],
      now,
      snoozedUntil: until,
    })).toBe(false)

    const later = new Date(until)
    later.setMinutes(later.getMinutes() + 1)
    expect(isReminderSnoozed(until, later)).toBe(false)
    expect(shouldSendReminder({
      enabled: true,
      reminderTime: '09:00',
      entries: [],
      now: new Date(2026, 7, 17, 9, 5),
      snoozedUntil: until,
    })).toBe(true)
  })
})
