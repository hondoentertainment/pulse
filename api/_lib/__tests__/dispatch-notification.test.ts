import { describe, it, expect, vi } from 'vitest'
import { dispatchUserNotification } from '../dispatch-notification'

vi.mock('../notify', () => ({
  sendPush: vi.fn(async () => ({ ok: true, provider: 'supabase-realtime' as const })),
}))

vi.mock('../push', () => ({
  sendPushToUser: vi.fn(async () => ({
    userId: 'u1',
    dispatched: 1,
    skipped: 0,
    logOnly: false,
    errors: [],
  })),
}))

import { sendPush } from '../notify'
import { sendPushToUser } from '../push'

describe('dispatchUserNotification', () => {
  it('fans out to realtime and native channels in parallel', async () => {
    const result = await dispatchUserNotification({
      userId: 'u1',
      title: 'Hi',
      body: 'there',
      data: { sessionId: 's1' },
    })

    expect(sendPush).toHaveBeenCalledWith(
      {
        userId: 'u1',
        title: 'Hi',
        body: 'there',
        data: { sessionId: 's1' },
      },
      undefined,
    )
    expect(sendPushToUser).toHaveBeenCalledWith(
      {
        userId: 'u1',
        title: 'Hi',
        body: 'there',
        data: { sessionId: 's1' },
      },
      undefined,
    )
    expect(result.realtime.provider).toBe('supabase-realtime')
    expect(result.native.dispatched).toBe(1)
  })
})
