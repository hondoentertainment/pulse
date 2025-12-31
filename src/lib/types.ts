export type EnergyRating = 'dead' | 'chill' | 'buzzing' | 'electric'

export interface User {
  id: string
  username: string
  profilePhoto?: string
  friends: string[]
  createdAt: string
}

export interface Venue {
  id: string
  name: string
  location: {
    lat: number
    lng: number
    address: string
  }
  pulseScore: number
  lastPulseAt?: string
  category?: string
}

export interface Pulse {
  id: string
  userId: string
  venueId: string
  photos: string[]
  video?: string
  energyRating: EnergyRating
  caption?: string
  createdAt: string
  expiresAt: string
  reactions: {
    fire: number
    eyes: number
    skull: number
    lightning: number
  }
  views: number
}

export interface PulseWithUser extends Pulse {
  user: User
  venue: Venue
}

export type NotificationType = 'friend_pulse' | 'pulse_reaction' | 'friend_nearby' | 'trending_venue'

export interface Notification {
  id: string
  type: NotificationType
  userId: string
  pulseId?: string
  venueId?: string
  reactionType?: 'fire' | 'eyes' | 'skull' | 'lightning'
  createdAt: string
  read: boolean
}

export interface NotificationWithData extends Notification {
  user?: User
  pulse?: PulseWithUser
  venue?: Venue
}

export interface GroupedNotification extends NotificationWithData {
  groupedUsers?: User[]
  groupedReactionTypes?: ('fire' | 'eyes' | 'skull' | 'lightning')[]
  count?: number
}

export const ENERGY_CONFIG = {
  dead: {
    label: 'Dead',
    value: 0,
    color: 'oklch(0.35 0.05 240)',
    emoji: '💀'
  },
  chill: {
    label: 'Chill',
    value: 1,
    color: 'oklch(0.60 0.15 150)',
    emoji: '😌'
  },
  buzzing: {
    label: 'Buzzing',
    value: 2,
    color: 'oklch(0.70 0.22 60)',
    emoji: '🔥'
  },
  electric: {
    label: 'Electric',
    value: 3,
    color: 'oklch(0.65 0.28 340)',
    emoji: '⚡'
  }
} as const

export const COOLDOWN_MINUTES = 120
export const PULSE_DECAY_MINUTES = 90
export const CHECK_IN_RADIUS_MILES = 0.062
