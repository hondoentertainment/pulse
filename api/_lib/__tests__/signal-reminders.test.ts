import { afterEach, describe, expect, it } from 'vitest'
import { isCronAuthorized, selectReminderRecipients } from '../signal-reminders'

describe('selectReminderRecipients', () => {
  it('selects enabled unlogged users inside the local window', () => {
    const now = new Date('2026-08-16T16:05:00.000Z')
    const recipients = selectReminderRecipients({
      now,
      profiles: [
        { user_id: 'a', reminder_enabled: true, reminder_time: '09:00', reminder_timezone: 'America/Los_Angeles' },
        { user_id: 'b', reminder_enabled: true, reminder_time: '09:00', reminder_timezone: 'America/Los_Angeles' },
        { user_id: 'c', reminder_enabled: false, reminder_time: '09:00', reminder_timezone: 'America/Los_Angeles' },
      ],
      logged: [{ user_id: 'b', day_key: '2026-08-16' }],
    })

    expect(recipients.map((row) => row.userId)).toEqual(['a'])
  })

  it('skips users outside the 15-minute window', () => {
    const now = new Date('2026-08-16T20:00:00.000Z')
    const recipients = selectReminderRecipients({
      now,
      profiles: [
        { user_id: 'a', reminder_enabled: true, reminder_time: '09:00', reminder_timezone: 'America/Los_Angeles' },
      ],
      logged: [],
    })
    expect(recipients).toEqual([])
  })
})

describe('isCronAuthorized', () => {
  const previous = process.env.CRON_SECRET

  afterEach(() => {
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  })

  it('rejects a spoofed x-vercel-cron header when a secret is configured', () => {
    process.env.CRON_SECRET = 'test-secret'
    expect(isCronAuthorized({
      headers: { 'x-vercel-cron': '1' },
    })).toBe(false)
  })

  it('accepts the Bearer secret or ?secret=', () => {
    process.env.CRON_SECRET = 'test-secret'
    expect(isCronAuthorized({
      headers: { authorization: 'Bearer test-secret' },
    })).toBe(true)
    expect(isCronAuthorized({
      query: { secret: 'test-secret' },
    })).toBe(true)
  })
})
