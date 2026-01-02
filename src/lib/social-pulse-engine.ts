import { 
  SocialPost, 
  SocialPulseWindow, 
  VenuePulseWindow,
  PulseCorrelation,
  TimeWindowSize,
  Pulse,
  Venue
} from './types'

export function calculateSocialPulseScore(posts: SocialPost[]): {
  volume: number
  engagementWeightedIntensity: number
  velocity: number
  normalizedScore: number
} {
  if (posts.length === 0) {
    return {
      volume: 0,
      engagementWeightedIntensity: 0,
      velocity: 0,
      normalizedScore: 0
    }
  }

  const volume = posts.length
  
  const now = new Date()
  const totalEngagement = posts.reduce((sum, post) => {
    const age = now.getTime() - new Date(post.timestamp).getTime()
    const ageMinutes = age / (1000 * 60)
    const recencyWeight = Math.exp(-ageMinutes / 30)
    
    const engagement = post.likes + (post.replies * 2) + (post.reposts * 3)
    return sum + (engagement * recencyWeight)
  }, 0)
  
  const engagementWeightedIntensity = totalEngagement / Math.max(1, volume)
  
  const sortedPosts = [...posts].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  
  const midpoint = Math.floor(sortedPosts.length / 2)
  const firstHalf = sortedPosts.slice(0, midpoint)
  const secondHalf = sortedPosts.slice(midpoint)
  
  const firstHalfRate = firstHalf.length
  const secondHalfRate = secondHalf.length
  const velocity = secondHalfRate - firstHalfRate
  
  const volumeScore = Math.min(100, (volume / 50) * 100)
  const intensityScore = Math.min(100, (engagementWeightedIntensity / 100) * 100)
  const velocityScore = Math.max(0, Math.min(100, 50 + velocity * 10))
  
  const normalizedScore = Math.round(
    volumeScore * 0.4 + intensityScore * 0.4 + velocityScore * 0.2
  )
  
  return {
    volume,
    engagementWeightedIntensity: Math.round(engagementWeightedIntensity * 100) / 100,
    velocity,
    normalizedScore: Math.max(0, Math.min(100, normalizedScore))
  }
}

export function createSocialPulseWindow(
  hashtag: string,
  posts: SocialPost[],
  windowSize: TimeWindowSize,
  startTime: Date,
  endTime: Date,
  venueId?: string
): SocialPulseWindow {
  const windowPosts = posts.filter(post => {
    const postTime = new Date(post.timestamp)
    return postTime >= startTime && postTime < endTime
  })
  
  const score = calculateSocialPulseScore(windowPosts)
  const totalEngagement = windowPosts.reduce(
    (sum, p) => sum + p.likes + p.replies + p.reposts, 
    0
  )
  
  return {
    id: `social-window-${hashtag}-${windowSize}-${startTime.getTime()}`,
    hashtag,
    venueId,
    windowSize,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    postCount: score.volume,
    totalEngagement,
    engagementWeightedIntensity: score.engagementWeightedIntensity,
    velocity: score.velocity,
    normalizedScore: score.normalizedScore,
    createdAt: new Date().toISOString()
  }
}

export function createVenuePulseWindow(
  venueId: string,
  pulses: Pulse[],
  venue: Venue,
  windowSize: TimeWindowSize,
  startTime: Date,
  endTime: Date
): VenuePulseWindow {
  const windowPulses = pulses.filter(pulse => {
    const pulseTime = new Date(pulse.createdAt)
    return pulse.venueId === venueId && pulseTime >= startTime && pulseTime < endTime
  })
  
  const energyValues = {
    'dead': 0,
    'chill': 33,
    'buzzing': 66,
    'electric': 100
  }
  
  const averageEnergy = windowPulses.length > 0
    ? windowPulses.reduce((sum, p) => sum + energyValues[p.energyRating], 0) / windowPulses.length
    : 0
  
  return {
    id: `venue-window-${venueId}-${windowSize}-${startTime.getTime()}`,
    venueId,
    windowSize,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    pulseScore: venue.pulseScore,
    pulseCount: windowPulses.length,
    averageEnergy: Math.round(averageEnergy),
    createdAt: new Date().toISOString()
  }
}

export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0
  
  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)
  
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  
  if (denominator === 0) return 0
  
  return numerator / denominator
}

export function detectLag(
  socialWindows: SocialPulseWindow[],
  venueWindows: VenuePulseWindow[],
  maxLagMinutes: number = 60
): number {
  if (socialWindows.length < 3 || venueWindows.length < 3) return 0
  
  const socialScores = socialWindows.map(w => w.normalizedScore)
  const venueScores = venueWindows.map(w => w.pulseScore)
  
  let bestCorrelation = -1
  let bestLag = 0
  
  const maxLagWindows = Math.floor(maxLagMinutes / 5)
  
  for (let lag = -maxLagWindows; lag <= maxLagWindows; lag++) {
    const socialLagged = lag >= 0 
      ? socialScores.slice(lag)
      : socialScores
    const venueLagged = lag >= 0
      ? venueScores
      : venueScores.slice(-lag)
    
    const minLength = Math.min(socialLagged.length, venueLagged.length)
    if (minLength < 3) continue
    
    const correlation = calculatePearsonCorrelation(
      socialLagged.slice(0, minLength),
      venueLagged.slice(0, minLength)
    )
    
    if (Math.abs(correlation) > Math.abs(bestCorrelation)) {
      bestCorrelation = correlation
      bestLag = lag * 5
    }
  }
  
  return bestLag
}

export function calculateCorrelation(
  socialWindows: SocialPulseWindow[],
  venueWindows: VenuePulseWindow[],
  venueId: string,
  windowSize: '60min' | '120min'
): PulseCorrelation {
  const socialScores = socialWindows.map(w => w.normalizedScore)
  const venueScores = venueWindows.map(w => w.pulseScore)
  
  const correlationCoefficient = calculatePearsonCorrelation(socialScores, venueScores)
  const lag = detectLag(socialWindows, venueWindows)
  
  const avgSocialScore = socialScores.length > 0
    ? socialScores.reduce((a, b) => a + b, 0) / socialScores.length
    : 0
  
  const avgVenueScore = venueScores.length > 0
    ? venueScores.reduce((a, b) => a + b, 0) / venueScores.length
    : 0
  
  let strength: 'low' | 'medium' | 'high' = 'low'
  const absCorr = Math.abs(correlationCoefficient)
  if (absCorr >= 0.7) strength = 'high'
  else if (absCorr >= 0.4) strength = 'medium'
  
  return {
    id: `correlation-${venueId}-${windowSize}-${Date.now()}`,
    venueId,
    windowSize,
    correlationCoefficient: Math.round(correlationCoefficient * 1000) / 1000,
    lag,
    socialPulseScore: Math.round(avgSocialScore),
    venuePulseScore: Math.round(avgVenueScore),
    strength,
    calculatedAt: new Date().toISOString()
  }
}

export function inferVenueFromText(text: string, venues: Venue[]): string | undefined {
  const normalizedText = text.toLowerCase()
  
  for (const venue of venues) {
    const venueName = venue.name.toLowerCase()
    const venueWords = venueName.split(/\s+/)
    
    if (normalizedText.includes(venueName)) {
      return venue.id
    }
    
    if (venueWords.length >= 2) {
      const matchCount = venueWords.filter(word => 
        word.length > 3 && normalizedText.includes(word)
      ).length
      
      if (matchCount >= Math.ceil(venueWords.length * 0.6)) {
        return venue.id
      }
    }
  }
  
  return undefined
}

export function mapSocialPostToVenue(
  post: SocialPost,
  venues: Venue[],
  hashtagVenueMap: Map<string, string>
): string | undefined {
  if (hashtagVenueMap.has(post.hashtag)) {
    return hashtagVenueMap.get(post.hashtag)
  }
  
  if (post.placeId || post.placeName) {
    const matchedVenue = venues.find(v => 
      v.location.address.toLowerCase().includes(post.placeName?.toLowerCase() || '')
    )
    if (matchedVenue) return matchedVenue.id
  }
  
  return inferVenueFromText(post.text, venues)
}
