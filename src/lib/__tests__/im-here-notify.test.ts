import { describe, expect, it } from 'vitest'
import { encodeGlancePush } from '../glance-push'
import {
  imHereDisplayName,
  imHereFollowerFanoutOpen,
  imHereFollowerGlancePayload,
  imHereGlanceStillOpen,
  imHereRateLimitOpen,
  imHereSelfGlancePayload,
  presenceAllowsFollowerGlance,
  readPresenceGlancePolicy,
  selectImHereDeliveries,
  type ImHereTokenRow,
} from '../im-here-notify'
import { META_GLASSES_COMPANION_COPY } from '../meta-glasses-companion'

const actor = 'actor-1'
const friend = 'friend-1'

function token(partial: Partial<ImHereTokenRow> & Pick<ImHereTokenRow, 'userId'>): ImHereTokenRow {
  return {
    endpoint: `https://push.example/${partial.userId}`,
    p256dh: 'p256',
    auth: 'auth',
    quietStart: null,
    quietEnd: null,
    ...partial,
  }
}

describe('I’m-here notify decision', () => {
  it('sends a self glance on the first confirm and skips a repeat inside the window', () => {
    expect(imHereRateLimitOpen(1)).toBe(true)
    expect(imHereRateLimitOpen(0)).toBe(true)
    expect(imHereRateLimitOpen(2)).toBe(false)
    expect(imHereGlanceStillOpen(0, true)).toBe(true)
    expect(imHereGlanceStillOpen(1, true)).toBe(false)
    expect(imHereGlanceStillOpen(0, false)).toBe(true)
    expect(imHereGlanceStillOpen(null, true)).toBe(true)
    expect(imHereFollowerFanoutOpen(1)).toBe(true)
    expect(imHereFollowerFanoutOpen(0)).toBe(false)
    expect(imHereFollowerFanoutOpen(2)).toBe(false)

    const tokens = [token({ userId: actor, quietStart: 22, quietEnd: 7 })]
    const open = selectImHereDeliveries({
      actorUserId: actor,
      hour: 23,
      rateLimitOpen: true,
      notifyFollowers: false,
      followerIds: new Set(),
      tokens,
    })
    expect(open.map((row) => row.role)).toEqual(['self'])

    expect(selectImHereDeliveries({
      actorUserId: actor,
      hour: 23,
      rateLimitOpen: false,
      notifyFollowers: true,
      followerIds: new Set([friend]),
      tokens: [...tokens, token({ userId: friend })],
    })).toEqual([])
  })

  it('notifies followers who follow the actor, and drops quiet-hour or opted-out presence', () => {
    expect(presenceAllowsFollowerGlance({ enabled: true, visibility: 'friends' })).toBe(true)
    expect(presenceAllowsFollowerGlance({ enabled: true, visibility: 'everyone' })).toBe(true)
    expect(presenceAllowsFollowerGlance({ enabled: false, visibility: 'everyone' })).toBe(false)
    expect(presenceAllowsFollowerGlance({ enabled: true, visibility: 'off' })).toBe(false)
    expect(readPresenceGlancePolicy({ enabled: true, visibility: 'friends' })).toEqual({
      enabled: true,
      visibility: 'friends',
    })

    const deliveries = selectImHereDeliveries({
      actorUserId: actor,
      hour: 23,
      rateLimitOpen: true,
      notifyFollowers: true,
      followerIds: new Set([friend, 'quiet-friend']),
      tokens: [
        token({ userId: actor }),
        token({ userId: friend, quietStart: null, quietEnd: null }),
        token({ userId: 'quiet-friend', endpoint: 'https://push.example/quiet', quietStart: 22, quietEnd: 7 }),
        token({ userId: 'stranger' }),
        token({ userId: friend, endpoint: '', p256dh: '', auth: '' }),
      ],
    })

    expect(deliveries.map((row) => [row.userId, row.role])).toEqual([
      [actor, 'self'],
      [friend, 'follower'],
    ])

    const held = selectImHereDeliveries({
      actorUserId: actor,
      hour: 21,
      rateLimitOpen: true,
      notifyFollowers: false,
      followerIds: new Set([friend]),
      tokens: [token({ userId: actor }), token({ userId: friend })],
    })
    expect(held.map((row) => row.role)).toEqual(['self'])
  })

  it('builds short kind-tagged glances and hides email-shaped names', () => {
    const self = imHereSelfGlancePayload({ venueId: 'neumos', venueName: 'Neumos' })
    expect(self).toMatchObject({
      title: "You're at Neumos · Pulse",
      body: 'Open the map',
      url: '/?here=neumos',
      kind: 'im_here',
      tag: 'im-here:neumos',
      renotify: false,
    })
    expect(self.title.length).toBeLessThanOrEqual(48)

    const long = imHereSelfGlancePayload({
      venueId: 'long-room',
      venueName: 'The Extremely Long Seattle Listening Room and Cocktail Bar',
    })
    expect(long.title.startsWith("You're at ")).toBe(true)
    expect(long.title.endsWith(' · Pulse')).toBe(true)
    expect(long.title.length).toBeLessThanOrEqual(48)
    expect(long.tag).toBe('im-here:long-room')

    expect(imHereDisplayName({ username: 'kyle@example.com' })).toBe('Someone you follow')
    const follower = imHereFollowerGlancePayload({
      venueId: 'neumos',
      venueName: 'Neumos',
      displayName: imHereDisplayName({ displayName: 'Kyle', username: 'kyle@example.com' }),
    })
    expect(follower.title).toBe('Kyle is here')
    expect(follower.body).toBe('Neumos')
    expect(follower.kind).toBe('im_here')
    expect(follower.tag).toBe('im-here:neumos')

    const encoded = JSON.parse(encodeGlancePush(self)) as { data: { kind: string; tag: string; url: string } }
    expect(encoded.data).toMatchObject({
      kind: 'im_here',
      tag: 'im-here:neumos',
      url: '/?here=neumos',
    })
  })
})

describe('Meta glasses companion copy', () => {
  it('explains phone mirroring without a glasses SDK or another city', () => {
    const text = `${META_GLASSES_COMPANION_COPY.title} ${META_GLASSES_COMPANION_COPY.body} ${META_GLASSES_COMPANION_COPY.quietHoursNote}`
    expect(text).toMatch(/Meta AI/)
    expect(text).toMatch(/Seattle-only/)
    expect(text).toMatch(/Install Pulse/)
    expect(text).toMatch(/I’m here/)
    expect(text).not.toMatch(/Signal/)
    expect(text).not.toMatch(/Wearables SDK/)
  })
})
