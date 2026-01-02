export type EnergyRating = 'dead' | 'chill' | 'buzzing' | 'electric'

export interface User {
  id: string
  username: string
  profilePhoto?: string
  friends: string[]
  favoriteVenues?: string[]
  followedVenues?: string[]
  createdAt: string
  venueCheckInHistory?: {
    [venueId: string]: number
  }
  credibilityScore?: number
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
  hours?: {
    monday?: string
    tuesday?: string
    wednesday?: string
    thursday?: string
    friday?: string
    saturday?: string
    sunday?: string
  }
  phone?: string
  website?: string
  preTrending?: boolean
  preTrendingLabel?: string
  seeded?: boolean
  verifiedCheckInCount?: number
  firstRealCheckInAt?: string
  scoreVelocity?: number
}

export interface Pulse {
  id: string
  userId: string
  venueId: string
  photos: string[]
  video?: string
  energyRating: EnergyRating
  caption?: string
  hashtags?: string[]
  createdAt: string
  expiresAt: string
  reactions: {
    fire: number
    eyes: number
    skull: number
    lightning: number
  }
  views: number
  isPending?: boolean
  uploadError?: boolean
  credibilityWeight?: number
}

export interface PulseWithUser extends Pulse {
  user: User
  venue: Venue
}

export type NotificationType = 'friend_pulse' | 'pulse_reaction' | 'friend_nearby' | 'trending_venue' | 'impact'

export interface Notification {
  id: string
  type: NotificationType
  userId: string
  pulseId?: string
  venueId?: string
  reactionType?: 'fire' | 'eyes' | 'skull' | 'lightning'
  energyThreshold?: 'buzzing' | 'electric'
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

export type HashtagCategory = 'nightlife' | 'sports' | 'music' | 'food' | 'cafes' | 'general'
export type HashtagVibeType = 'energetic' | 'chill' | 'social' | 'foodie' | 'cultural'

export interface Hashtag {
  id: string
  name: string
  emoji: string
  category: HashtagCategory
  vibeType: HashtagVibeType
  seeded: boolean
  usageCount: number
  verifiedUsageCount: number
  decayScore: number
  lastUsedAt?: string
  createdAt: string
  createdByUserId?: string
}

export interface HashtagSuggestionContext {
  venueCategory?: string
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'latenight'
  dayOfWeek: 'weekday' | 'weekend'
  pulseScore: number
  energyRating: EnergyRating
}

export interface VenueAnalytics {
  venueId: string
  preTrendingConversionRate?: number
  timeToFirstRealActivity?: number
  seededHashtagConversionRate?: number
  totalVerifiedCheckIns: number
  lastAnalyzedAt: string
}

export interface SocialPost {
  id: string
  postId: string
  text: string
  timestamp: string
  likes: number
  replies: number
  reposts: number
  placeId?: string
  placeName?: string
  venueId?: string
  hashtag: string
  createdAt: string
}

export interface TrackedHashtag {
  id: string
  hashtag: string
  venueId?: string
  active: boolean
  lastPolledAt?: string
  createdAt: string
  updatedAt: string
}

export type TimeWindowSize = '5min' | '15min' | '60min'

export interface SocialPulseWindow {
  id: string
  hashtag: string
  venueId?: string
  windowSize: TimeWindowSize
  startTime: string
  endTime: string
  postCount: number
  totalEngagement: number
  engagementWeightedIntensity: number
  velocity: number
  normalizedScore: number
  createdAt: string
}

export interface VenuePulseWindow {
  id: string
  venueId: string
  windowSize: TimeWindowSize
  startTime: string
  endTime: string
  pulseScore: number
  pulseCount: number
  averageEnergy: number
  createdAt: string
}

export interface PulseCorrelation {
  id: string
  venueId: string
  windowSize: '60min' | '120min'
  correlationCoefficient: number
  lag: number
  socialPulseScore: number
  venuePulseScore: number
  strength: 'low' | 'medium' | 'high'
  calculatedAt: string
}

export interface CorrelationInsight {
  venueId: string
  venueName: string
  correlation60: number
  correlation120: number
  lag: number
  strength: 'low' | 'medium' | 'high'
  hasSocialBuzz: boolean
  socialPulseScore: number
  venuePulseScore: number
}
