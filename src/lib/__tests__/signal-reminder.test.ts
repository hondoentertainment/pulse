import { describe, expect, it } from 'vitest'
import {
  parseReminderTime,
  msUntilNextReminder,
  isReminderDue,
  shouldNudgeForCheckIn,
  DEFAULT_REMINDER_TIME,
} from '@/lib/signal-reminder'
import type { SignalEntry } from '@/lib/signal-insights'

let seq = 0
function entry(createdAt: Date): SignalEntry {
  seq += 1
  return {
    id: `r${seq}`,
    userId: 'u1',
    createdAt: createdAt.toISOString(),
    focus: 'energy',
    score: 70,
    energy: 7,
    mood: 7,
    stress: 4,
    sleepQuality: 7,
    tags: [],
  }
}

/** Local-time helper so assertions don't depend on the runner's timezone. */
const at = (h: number, m: number, day = 15) => new Date(2026, 6, day, h, m, 0, 0)

describe('parseReminderTime', () => {
  it('parses valid times', () => {
    expect(parseReminderTime('09:00')).toEqual({ hours: 9, minutes: 0 })
    expect(parseReminderTime('23:59')).toEqual({ hours: 23, minutes: 59 })
    expect(parseReminderTime('00:00')).toEqual({ hours: 0, minutes: 0 })
  })

  it('rejects malformed times', () => {
    for (const bad of ['24:00', '9:00', '09:60', '', 'abc', '09-00']) {
      expect(parseReminderTime(bad)).toBeNull()
    }
  })

  it('has a valid default', () => {
    expect(parseReminderTime(DEFAULT_REMINDER_TIME)).not.toBeNull()
  })
})

describe('msUntilNextReminder', () => {
  it('counts forward to later today', () => {
    // 08:00 now, reminder at 09:00 → 1 hour
    expect(msUntilNextReminder('09:00', at(8, 0))).toBe(60 * 60 * 1000)
  })

  it('rolls over to tomorrow once the time has passed', () => {
    // 10:00 now, reminder at 09:00 → 23 hours
    expect(msUntilNextReminder('09:00', at(10, 0))).toBe(23 * 60 * 60 * 1000)
  })

  it('rolls over when exactly at the reminder time', () => {
    expect(msUntilNextReminder('09:00', at(9, 0))).toBe(24 * 60 * 60 * 1000)
  })

  it('returns null for a malformed time', () => {
    expect(msUntilNextReminder('nope', at(8, 0))).toBeNull()
  })
})

describe('isReminderDue', () => {
  it('is false before the time and true after', () => {
    expect(isReminderDue('09:00', at(8, 59))).toBe(false)
    expect(isReminderDue('09:00', at(9, 0))).toBe(true)
    expect(isReminderDue('09:00', at(21, 30))).toBe(true)
  })

  it('treats malformed times as not due', () => {
    expect(isReminderDue('bogus', at(23, 0))).toBe(false)
  })
})

describe('shouldNudgeForCheckIn', () => {
  const opts = { enabled: true, reminderTime: '09:00' }

  it('nudges when due and today has no entry', () => {
    expect(shouldNudgeForCheckIn([], opts, at(10, 0))).toBe(true)
  })

  it('does not nudge before the reminder time', () => {
    expect(shouldNudgeForCheckIn([], opts, at(8, 0))).toBe(false)
  })

  it('does not nudge when today is already logged', () => {
    const today = [entry(at(9, 30))]
    expect(shouldNudgeForCheckIn(today, opts, at(10, 0))).toBe(false)
  })

  it('still nudges when only earlier days are logged', () => {
    const yesterday = [entry(at(9, 30, 14))]
    expect(shouldNudgeForCheckIn(yesterday, opts, at(10, 0))).toBe(true)
  })

  it('does not nudge when reminders are disabled', () => {
    expect(shouldNudgeForCheckIn([], { ...opts, enabled: false }, at(10, 0))).toBe(false)
  })
})
