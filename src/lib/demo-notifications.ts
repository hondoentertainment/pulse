import { Notification, Pulse, User, EnergyRating } from './types'

const POPULAR_SEATTLE_VENUES = [
  'venue-3',
  'venue-8',
  'venue-1',
  'venue-6',
  'venue-13',
  'venue-60',
  'venue-66',
  'venue-56',
  'venue-52',
  'venue-88',
  'venue-71',
  'venue-79',
  'venue-75',
  'venue-69',
  'venue-65',
  'venue-34',
  'venue-39',
  'venue-44',
  'venue-42',
  'venue-62',
  'venue-40'
]

const SEATTLE_CAPTIONS = {
  dead: [
    'Dead tonight, but the bartender is cool',
    'Ghost town vibes',
    'Peaceful - finally got a table',
    'Where is everyone?',
    'Perfect spot for a quiet drink',
    null
  ],
  chill: [
    'Mellow vibes, good conversation',
    'Relaxed crowd tonight',
    'Great spot to unwind after work',
    'Chill music, better beer',
    'Low-key perfection',
    'Seattle drizzle and good company',
    null
  ],
  buzzing: [
    'This place is picking up! 🎶',
    'Energy is building',
    'Perfect Friday night energy',
    'Crowd is loving it',
    'Getting packed in here!',
    'Seattle showing out tonight',
    null
  ],
  electric: [
    'ABSOLUTELY WILD RIGHT NOW! ⚡',
    'This DJ is insane! 🔥',
    'Best night in Seattle this year!',
    'Can barely move - SO PACKED',
    'Electric energy everywhere!',
    'Never seen it this lit! 💀',
    'Line is crazy but SO worth it',
    null
  ]
}

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400&h=300&fit=crop'
]

export function generateDemoNotifications(
  currentUser: User,
  existingPulses: Pulse[],
  venueIds: string[]
): { notifications: Notification[]; pulses: Pulse[] } {
  const now = Date.now()
  const notifications: Notification[] = []
  const newPulses: Pulse[] = []

  const energyRatings: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

  const usableVenueIds = POPULAR_SEATTLE_VENUES.filter(id => venueIds.includes(id))
  if (usableVenueIds.length === 0) {
    return {
      notifications,
      pulses: existingPulses
    }
  }

  for (let i = 0; i < 12; i++) {
    const minutesAgo = Math.floor(Math.random() * 120) + 5
    const pulseId = `demo-pulse-${now - minutesAgo * 60000}-${i}`
    const venueId = usableVenueIds[i % usableVenueIds.length]
    const energyRating = energyRatings[Math.floor(Math.random() * energyRatings.length)]
    const captionOptions = SEATTLE_CAPTIONS[energyRating]
    const caption = captionOptions[Math.floor(Math.random() * captionOptions.length)]
    
    const hasPhoto = Math.random() > 0.3
    const photoIndex = i % SAMPLE_IMAGES.length
    
    const pulse: Pulse = {
      id: pulseId,
      userId: currentUser.id,
      venueId,
      photos: hasPhoto ? [SAMPLE_IMAGES[photoIndex]] : [],
      energyRating,
      caption: caption || undefined,
      createdAt: new Date(now - minutesAgo * 60000).toISOString(),
      expiresAt: new Date(now - minutesAgo * 60000 + 90 * 60 * 1000).toISOString(),
      reactions: {
        fire: Math.floor(Math.random() * 15),
        eyes: Math.floor(Math.random() * 8),
        skull: Math.floor(Math.random() * 5),
        lightning: Math.floor(Math.random() * 12)
      },
      views: Math.floor(Math.random() * 80) + 15
    }

    newPulses.push(pulse)

    if (i < 8) {
      const notification: Notification = {
        id: `demo-notif-${now - minutesAgo * 60000}-${i}`,
        type: 'friend_pulse',
        userId: currentUser.id,
        pulseId,
        venueId,
        createdAt: new Date(now - minutesAgo * 60000).toISOString(),
        read: Math.random() > 0.4
      }

      notifications.push(notification)
    }
  }

  for (let i = 0; i < 5; i++) {
    const minutesAgo = Math.floor(Math.random() * 45) + 2
    const venueId = usableVenueIds[(i * 3) % usableVenueIds.length]
    
    const trendingNotification: Notification = {
      id: `demo-trending-${now - minutesAgo * 60000}-${i}`,
      type: 'trending_venue',
      userId: 'system',
      venueId,
      createdAt: new Date(now - minutesAgo * 60000).toISOString(),
      read: Math.random() > 0.6
    }

    notifications.push(trendingNotification)
  }

  for (let i = 0; i < 3; i++) {
    const minutesAgo = Math.floor(Math.random() * 60) + 10
    const venueId = usableVenueIds[(i * 2) % usableVenueIds.length]
    
    const nearbyNotification: Notification = {
      id: `demo-nearby-${now - minutesAgo * 60000}-${i}`,
      type: 'friend_nearby',
      userId: currentUser.id,
      venueId,
      createdAt: new Date(now - minutesAgo * 60000).toISOString(),
      read: Math.random() > 0.5
    }

    notifications.push(nearbyNotification)
  }

  return {
    notifications,
    pulses: [...existingPulses, ...newPulses]
  }
}
