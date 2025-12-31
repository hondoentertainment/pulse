import { Notification, Pulse, User, EnergyRating } from './types'

export function generateDemoNotifications(
  currentUser: User,
  existingPulses: Pulse[],
  venueIds: string[]
): { notifications: Notification[]; pulses: Pulse[] } {
  const now = Date.now()
  const notifications: Notification[] = []
  const newPulses: Pulse[] = []

  const energyRatings: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']
  const captions = [
    'This place is wild tonight! 🎉',
    'Perfect vibes for a chill evening',
    'DJ is killing it right now',
    'Empty but the drinks are good',
    'Line around the block - must be good',
    'Best night out in weeks!',
    null,
    null
  ]

  for (let i = 0; i < 5; i++) {
    const minutesAgo = Math.floor(Math.random() * 120) + 5
    const pulseId = `demo-pulse-${now - minutesAgo * 60000}-${i}`
    const venueId = venueIds[Math.floor(Math.random() * venueIds.length)]
    const energyRating = energyRatings[Math.floor(Math.random() * energyRatings.length)]
    const caption = captions[Math.floor(Math.random() * captions.length)]
    
    const pulse: Pulse = {
      id: pulseId,
      userId: currentUser.id,
      venueId,
      photos: Math.random() > 0.5 ? [`https://picsum.photos/400/300?random=${i}`] : [],
      energyRating,
      caption: caption || undefined,
      createdAt: new Date(now - minutesAgo * 60000).toISOString(),
      expiresAt: new Date(now - minutesAgo * 60000 + 90 * 60 * 1000).toISOString(),
      reactions: {
        fire: Math.floor(Math.random() * 10),
        eyes: Math.floor(Math.random() * 5),
        skull: Math.floor(Math.random() * 3),
        lightning: Math.floor(Math.random() * 8)
      },
      views: Math.floor(Math.random() * 50) + 10
    }

    newPulses.push(pulse)

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

  return {
    notifications,
    pulses: [...existingPulses, ...newPulses]
  }
}
