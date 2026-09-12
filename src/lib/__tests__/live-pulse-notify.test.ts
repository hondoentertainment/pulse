import { describe, expect, it } from 'vitest'
import {
  collectLivePulseNotifyUserIds,
  livePulseNotifyPayload,
  selectLivePulseNotifyTargets,
} from '../live-pulse-notify'

describe('live pulse notify targeting', () => {
  it('notifies followers and nearby subscribers, never the author', () => {
    const targets = selectLivePulseNotifyTargets({
      authorUserId: 'author',
      followedUserIds: ['fan', 'author'],
      venueLocation: { lat: 47.61, lng: -122.32 },
      subscribers: [
        { userId: 'fan', scope: 'followed' },
        { userId: 'author', scope: 'followed' },
        { userId: 'nearby', scope: 'nearby', lat: 47.611, lng: -122.321 },
        { userId: 'far', scope: 'nearby', lat: 47.0, lng: -122.0 },
      ],
    })
    expect(targets.map((t) => t.userId).sort()).toEqual(['fan', 'nearby'])
  })

  it('writes in-app notifications for followers without a Web Push token', () => {
    expect(collectLivePulseNotifyUserIds({
      authorUserId: 'author',
      followedUserIds: ['fan', 'author', 'quiet-follower'],
      subscriberTargets: [{ userId: 'fan' }, { userId: 'nearby' }],
    }).sort()).toEqual(['fan', 'nearby', 'quiet-follower'])
  })

  it('builds venue-name title and venue deep link', () => {
    expect(livePulseNotifyPayload({
      venueId: 'neumos',
      venueName: 'Neumos',
      caption: 'Room is packed',
    })).toEqual({
      title: 'Neumos',
      body: 'Room is packed',
      url: '/venue/neumos',
    })
  })
})
