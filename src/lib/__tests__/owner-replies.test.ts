import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  selects: [] as string[],
  inserts: [] as unknown[],
}))

vi.mock('@/lib/supabase', () => {
  const row = {
    id: 'reply-1',
    pulse_id: 'p1',
    venue_id: 'neumos',
    user_id: 'owner-secret',
    body: 'Thanks',
    created_at: '2026-09-12T01:00:00.000Z',
  }
  function query() {
    const q: Record<string, unknown> = {}
    const self = () => q
    q.select = (cols: string) => {
      state.selects.push(cols)
      return q
    }
    q.eq = self
    q.is = self
    q.order = self
    q.limit = self
    q.insert = (payload: unknown) => {
      state.inserts.push(payload)
      return q
    }
    q.single = async () => ({ data: row, error: null })
    q.then = (resolve: (value: { data: unknown; error: null }) => void) => {
      resolve({ data: [row], error: null })
    }
    return q
  }
  return {
    supabase: {
      from: () => query(),
    },
  }
})

vi.mock('@/lib/auth/require-auth', () => ({
  requireUserId: async () => 'owner-1',
}))

import { createOwnerReplyOnServer, listOwnerRepliesForVenue } from '@/lib/data/owner-replies'

describe('owner reply reads', () => {
  beforeEach(() => {
    state.selects.length = 0
    state.inserts.length = 0
  })

  it('does not select or return the author id', async () => {
    const listed = await listOwnerRepliesForVenue('neumos')
    const saved = await createOwnerReplyOnServer({
      pulseId: 'p1',
      venueId: 'neumos',
      body: 'Thanks',
    })

    expect(state.selects).toEqual([
      'id, pulse_id, venue_id, body, created_at',
      'id, pulse_id, venue_id, body, created_at',
    ])
    expect(state.inserts).toEqual([{
      pulse_id: 'p1',
      venue_id: 'neumos',
      user_id: 'owner-1',
      body: 'Thanks',
    }])
    expect(listed).toEqual([{
      id: 'reply-1',
      pulseId: 'p1',
      venueId: 'neumos',
      body: 'Thanks',
      createdAt: '2026-09-12T01:00:00.000Z',
    }])
    expect(saved).toEqual(listed[0])
    const json = JSON.stringify({ listed, saved })
    expect(json).not.toContain('owner-secret')
    expect(json).not.toContain('owner-1')
    expect(json).not.toContain('user_id')
  })
})
