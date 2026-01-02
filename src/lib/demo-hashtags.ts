import { TrackedHashtag } from './types'

export const DEMO_HASHTAGS: Omit<TrackedHashtag, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    hashtag: 'nightlife',
    active: true
  },
  {
    hashtag: 'brunch',
    active: true
  },
  {
    hashtag: 'livemusic',
    active: true
  },
  {
    hashtag: 'happyhour',
    active: false
  },
  {
    hashtag: 'cocktails',
    active: false
  }
]

export function getDefaultHashtagsWithVenueMapping(venueIds: string[]): TrackedHashtag[] {
  const now = new Date().toISOString()
  
  return [
    {
      id: 'hashtag-nightlife',
      hashtag: 'nightlife',
      venueId: venueIds[0],
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'hashtag-brunch',
      hashtag: 'brunch',
      venueId: venueIds[1],
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'hashtag-livemusic',
      hashtag: 'livemusic',
      venueId: venueIds[2],
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ]
}
