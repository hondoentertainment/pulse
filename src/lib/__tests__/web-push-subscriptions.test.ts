import { beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.fn(async () => ({ error: null }))
const eq = vi.fn<(column: string, value: unknown) => unknown>()
const from = vi.fn<(table: string) => unknown>()

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => from(table) },
}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireUserId: async () => 'user-1',
}))

import {
  NOTIFICATIONS_RLS,
  persistWebPushSubscription,
  PUSH_TOKENS_RLS,
  removeWebPushSubscription,
} from '../data/web-push-subscriptions'

describe('push_tokens RLS intent (reused Web Push)', () => {
  it('uses existing push_tokens — owner CRUD, no second table', () => {
    expect(PUSH_TOKENS_RLS.table).toBe('push_tokens')
    expect(PUSH_TOKENS_RLS.select).toBe('auth.uid() = user_id')
    expect(PUSH_TOKENS_RLS.insert).toBe('auth.uid() = user_id')
    expect(PUSH_TOKENS_RLS.update).toBe('auth.uid() = user_id')
    expect(PUSH_TOKENS_RLS.delete).toBe('auth.uid() = user_id')
    expect(PUSH_TOKENS_RLS.webRow).toBe("platform = 'web'")
    expect(PUSH_TOKENS_RLS.anon).toBe('no writes')
  })

  it('reuses notifications.friend_pulse — no user INSERT policy', () => {
    expect(NOTIFICATIONS_RLS.table).toBe('notifications')
    expect(NOTIFICATIONS_RLS.insert).toBe('service_role only')
    expect(NOTIFICATIONS_RLS.livePulseType).toBe('friend_pulse')
  })
})

describe('persistWebPushSubscription', () => {
  beforeEach(() => {
    upsert.mockClear()
    eq.mockClear()
    from.mockReset()
    from.mockImplementation(() => {
      const query = {
        upsert,
        delete: () => query,
        eq: (column: string, value: unknown) => {
          eq(column, value)
          return query
        },
      }
      return query
    })
  })

  it('upserts platform=web on push_tokens using the endpoint as token', async () => {
    await persistWebPushSubscription({
      endpoint: 'https://push.example/1',
      keys: { p256dh: 'p', auth: 'a' },
      lat: 47.61,
      lng: -122.32,
    })
    expect(from).toHaveBeenCalledWith('push_tokens')
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        token: 'https://push.example/1',
        platform: 'web',
        p256dh: 'p',
        auth: 'a',
        lat: 47.61,
        lng: -122.32,
        scope: 'followed_or_nearby',
        last_seen_at: expect.any(String),
      },
      { onConflict: 'user_id,token' },
    )
  })

  it('deletes the web row by user + endpoint', async () => {
    await removeWebPushSubscription('https://push.example/1')
    expect(from).toHaveBeenCalledWith('push_tokens')
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eq).toHaveBeenCalledWith('token', 'https://push.example/1')
    expect(eq).toHaveBeenCalledWith('platform', 'web')
  })
})
