export type EnergyRating = 'dead' | 'chill' | 'buzzing' | 'electric'

/**
 * Structured venue metadata tokens (additive — all fields on Venue are
 * optional to keep every seeded / mock / legacy record valid).
 */
export type VenueDressCode =
  | 'casual'
  | 'smart_casual'
  | 'upscale'
  | 'formal'
  | 'costume_required'
  | 'no_code'

export type VenueIndoorOutdoor = 'indoor' | 'outdoor' | 'both'

export type AccessibilityFeature =
  | 'wheelchair_accessible'
  | 'step_free_entry'
  | 'accessible_restroom'
  | 'gender_neutral_restroom'
  | 'sensory_friendly'
  | 'quiet_hours'
  | 'service_animal_friendly'
  | 'signer_on_request'
  | 'braille_menu'

export const ACCESSIBILITY_FEATURES: readonly AccessibilityFeature[] = [
  'wheelchair_accessible',
  'step_free_entry',
  'accessible_restroom',
  'gender_neutral_restroom',
  'sensory_friendly',
  'quiet_hours',
  'service_animal_friendly',
  'signer_on_request',
  'braille_menu',
] as const

export type WaitTimeConfidence = 'low' | 'med' | 'high'

export interface VenueWaitTime {
  venueId: string
  estimatedMinutes: number
  confidence: WaitTimeConfidence
  sampleSize: number
  computedAt: string
}

/**
 * Weather payload returned by the /api/weather/current Edge Function and
 * consumed by `applyWeatherBoost` + `useWeather`. Kept in shared types so
 * both the client bundle and the Edge Function can reference it without
 * crossing tsconfig boundaries.
 */
export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'fog'
  | 'unknown'

export interface WeatherPayload {
  condition: WeatherCondition
  tempC: number
  precipitationPct: number
  windKph: number
  visibilityKm: number
  observedAt: string
}

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
  favoriteCategories?: string[]
  credibilityScore?: number
  presenceSettings?: {
    enabled: boolean
    visibility: 'everyone' | 'friends' | 'off'
    hideAtSensitiveVenues: boolean
  }
  postStreak?: number
  lastPostDate?: string
}

export interface Venue {
  id: string
  name: string
  location: {
    lat: number
    lng: number
    address: string
  }
  city?: string
  state?: string
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
  lastActivity?: string
  integrations?: {
    music?: {
      spotifyUrl?: string
      playlistName?: string
      searchTerm?: string
    }
    reservations?: {
      opentableId?: string
      opentableUrl?: string
      resyId?: string
      resyUrl?: string
    }
    maps?: {
      googleMapsUrl?: string
      appleMapsUrl?: string
    }
  }
  // Structured venue metadata (differentiator pack). All optional & additive.
  dressCode?: VenueDressCode
  coverChargeCents?: number
  coverChargeNote?: string
  accessibilityFeatures?: AccessibilityFeature[]
  indoorOutdoor?: VenueIndoorOutdoor
  /** Rough occupancy hint (used by the wait-time estimator). */
  capacityHint?: number
  /** Latest wait-time snapshot (hydrated at read time, not persisted on venues). */
  waitTime?: VenueWaitTime
  /** Transient scoring bonus applied by weather-aware ranking. */
  contextualScore?: number
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
    fire: string[]
    eyes: string[]
    skull: string[]
    lightning: string[]
  }
  views: number
  isPending?: boolean
  uploadError?: boolean
  credibilityWeight?: number
  crewId?: string
  isPioneer?: boolean
}

export interface PulseWithUser extends Pulse {
  user: User
  venue: Venue
}

export type NotificationType = 'friend_pulse' | 'pulse_reaction' | 'friend_nearby' | 'trending_venue' | 'impact' | 'wave'

export interface Notification {
  id: string
  type: NotificationType
  userId: string
  pulseId?: string
  venueId?: string
  reactionType?: 'fire' | 'eyes' | 'skull' | 'lightning'
  energyThreshold?: 'buzzing' | 'electric'
  recommendedVenueId?: string
  createdAt: string
  read: boolean
}

export interface NotificationWithData extends Notification {
  user?: User
  pulse?: PulseWithUser
  venue?: Venue
  recommendedVenue?: Venue
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
export interface PresenceData {
  venueId: string
  friendsHereNowCount: number
  friendsNearbyCount: number
  familiarFacesCount: number
  prioritizedAvatars: string[]
  lastPresenceUpdateAt: string
  isSuppressed: boolean
}
