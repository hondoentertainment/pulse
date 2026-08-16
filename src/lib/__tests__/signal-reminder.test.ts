import { describe, expect, it } from 'vitest'
import { msUntilReminder, reminderCopy, shouldSendReminder } from '@/lib/signal-reminder'

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
  })
})
