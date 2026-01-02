import { Hashtag, HashtagCategory, HashtagVibeType, HashtagSuggestionContext } from './types'

export const SEEDED_HASHTAGS: Omit<Hashtag, 'id' | 'usageCount' | 'verifiedUsageCount' | 'decayScore' | 'createdAt'>[] = [
  { name: 'LiveMusic', emoji: '🎸', category: 'music', vibeType: 'energetic', seeded: true },
  { name: 'DJSet', emoji: '🎧', category: 'music', vibeType: 'energetic', seeded: true },
  { name: 'OpenMic', emoji: '🎤', category: 'music', vibeType: 'social', seeded: true },
  { name: 'JazzNight', emoji: '🎺', category: 'music', vibeType: 'chill', seeded: true },
  { name: 'Karaoke', emoji: '🎙️', category: 'music', vibeType: 'social', seeded: true },
  
  { name: 'HappyHour', emoji: '🍻', category: 'nightlife', vibeType: 'social', seeded: true },
  { name: 'LateNight', emoji: '🌙', category: 'nightlife', vibeType: 'energetic', seeded: true },
  { name: 'DanceFloor', emoji: '💃', category: 'nightlife', vibeType: 'energetic', seeded: true },
  { name: 'CraftCocktails', emoji: '🍸', category: 'nightlife', vibeType: 'chill', seeded: true },
  { name: 'Rooftop', emoji: '🏙️', category: 'nightlife', vibeType: 'chill', seeded: true },
  { name: 'DateNight', emoji: '💑', category: 'nightlife', vibeType: 'chill', seeded: true },
  { name: 'Ladies Night', emoji: '👯', category: 'nightlife', vibeType: 'social', seeded: true },
  { name: 'ThirstyThursday', emoji: '🍺', category: 'nightlife', vibeType: 'social', seeded: true },
  { name: 'WeekendVibes', emoji: '🎉', category: 'nightlife', vibeType: 'energetic', seeded: true },
  
  { name: 'GameDay', emoji: '🏈', category: 'sports', vibeType: 'energetic', seeded: true },
  { name: 'MarchMadness', emoji: '🏀', category: 'sports', vibeType: 'energetic', seeded: true },
  { name: 'SundayFunday', emoji: '⚽', category: 'sports', vibeType: 'social', seeded: true },
  { name: 'SportsBar', emoji: '📺', category: 'sports', vibeType: 'social', seeded: true },
  { name: 'Playoffs', emoji: '🏆', category: 'sports', vibeType: 'energetic', seeded: true },
  
  { name: 'BrunchTime', emoji: '🥞', category: 'food', vibeType: 'chill', seeded: true },
  { name: 'TacoTuesday', emoji: '🌮', category: 'food', vibeType: 'social', seeded: true },
  { name: 'Foodie', emoji: '🍽️', category: 'food', vibeType: 'foodie', seeded: true },
  { name: 'PizzaParty', emoji: '🍕', category: 'food', vibeType: 'social', seeded: true },
  { name: 'Sushi', emoji: '🍣', category: 'food', vibeType: 'foodie', seeded: true },
  { name: 'BBQ', emoji: '🍖', category: 'food', vibeType: 'foodie', seeded: true },
  { name: 'FarmToTable', emoji: '🌱', category: 'food', vibeType: 'foodie', seeded: true },
  { name: 'CheatDay', emoji: '🍔', category: 'food', vibeType: 'foodie', seeded: true },
  
  { name: 'CoffeeFix', emoji: '☕', category: 'cafes', vibeType: 'chill', seeded: true },
  { name: 'RemoteWork', emoji: '💻', category: 'cafes', vibeType: 'chill', seeded: true },
  { name: 'MorningCoffee', emoji: '🌅', category: 'cafes', vibeType: 'chill', seeded: true },
  { name: 'StudySpace', emoji: '📚', category: 'cafes', vibeType: 'chill', seeded: true },
  { name: 'Latte', emoji: '🥛', category: 'cafes', vibeType: 'chill', seeded: true },
  
  { name: 'TGIF', emoji: '🎊', category: 'general', vibeType: 'social', seeded: true },
  { name: 'GoodVibes', emoji: '✨', category: 'general', vibeType: 'social', seeded: true },
  { name: 'SquadGoals', emoji: '👥', category: 'general', vibeType: 'social', seeded: true },
  { name: 'LocalSpot', emoji: '📍', category: 'general', vibeType: 'social', seeded: true },
  { name: 'HiddenGem', emoji: '💎', category: 'general', vibeType: 'cultural', seeded: true },
  { name: 'MustTry', emoji: '⭐', category: 'general', vibeType: 'social', seeded: true },
  { name: 'FirstTime', emoji: '🆕', category: 'general', vibeType: 'social', seeded: true },
]

export function initializeSeededHashtags(): Hashtag[] {
  const now = new Date().toISOString()
  return SEEDED_HASHTAGS.map((tag, index) => ({
    ...tag,
    id: `hashtag-seeded-${index}`,
    usageCount: 0,
    verifiedUsageCount: 0,
    decayScore: 100,
    createdAt: now,
  }))
}

export function getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'latenight' {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 23) return 'evening'
  return 'latenight'
}

export function getDayOfWeek(date: Date): 'weekday' | 'weekend' {
  const day = date.getDay()
  return day === 0 || day === 6 ? 'weekend' : 'weekday'
}

export function suggestHashtags(
  context: HashtagSuggestionContext,
  allHashtags: Hashtag[],
  maxSuggestions: number = 5
): { hashtags: Hashtag[]; label: string }[] {
  const suggestions: { hashtags: Hashtag[]; label: string }[] = []
  
  const categoryMatch = allHashtags
    .filter(h => h.category === context.venueCategory || h.category === 'general')
    .filter(h => h.decayScore > 30)
    .sort((a, b) => {
      const aScore = (a.verifiedUsageCount * 2 + a.usageCount) * (a.decayScore / 100)
      const bScore = (b.verifiedUsageCount * 2 + b.usageCount) * (b.decayScore / 100)
      return bScore - aScore
    })
  
  if (context.timeOfDay === 'morning' && context.venueCategory === 'cafes') {
    const morningTags = allHashtags.filter(h => 
      ['MorningCoffee', 'CoffeeFix', 'RemoteWork', 'StudySpace'].includes(h.name)
    )
    if (morningTags.length > 0) {
      suggestions.push({ hashtags: morningTags.slice(0, 3), label: 'Popular this morning' })
    }
  }
  
  if (context.timeOfDay === 'evening' && (context.venueCategory === 'nightlife' || context.venueCategory === 'food')) {
    const eveningTags = allHashtags.filter(h => 
      ['HappyHour', 'DateNight', 'WeekendVibes', 'TGIF'].includes(h.name) &&
      h.decayScore > 40
    )
    if (eveningTags.length > 0) {
      suggestions.push({ hashtags: eveningTags.slice(0, 3), label: 'Trending tonight' })
    }
  }
  
  if (context.dayOfWeek === 'weekend' && context.pulseScore >= 60) {
    const weekendTags = allHashtags.filter(h => 
      ['WeekendVibes', 'SundayFunday', 'BrunchTime', 'LateNight'].includes(h.name)
    )
    if (weekendTags.length > 0) {
      suggestions.push({ hashtags: weekendTags.slice(0, 3), label: 'Weekend favorites' })
    }
  }
  
  if (context.energyRating === 'electric' || context.energyRating === 'buzzing') {
    const energeticTags = allHashtags.filter(h => 
      h.vibeType === 'energetic' && h.decayScore > 35
    ).slice(0, 3)
    if (energeticTags.length > 0) {
      suggestions.push({ hashtags: energeticTags, label: 'High energy vibes' })
    }
  }
  
  if (categoryMatch.length > 0) {
    suggestions.push({ 
      hashtags: categoryMatch.slice(0, maxSuggestions), 
      label: 'Popular nearby' 
    })
  }
  
  return suggestions.slice(0, 2)
}

export function applyHashtagDecay(hashtags: Hashtag[]): Hashtag[] {
  const now = new Date()
  const DECAY_HOURS = 48
  const DECAY_RATE = 0.95
  
  return hashtags.map(hashtag => {
    if (!hashtag.lastUsedAt) {
      return {
        ...hashtag,
        decayScore: Math.max(20, hashtag.decayScore * DECAY_RATE)
      }
    }
    
    const hoursSinceUse = (now.getTime() - new Date(hashtag.lastUsedAt).getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceUse > DECAY_HOURS) {
      const decayFactor = Math.pow(DECAY_RATE, Math.floor(hoursSinceUse / DECAY_HOURS))
      return {
        ...hashtag,
        decayScore: Math.max(hashtag.seeded ? 20 : 5, hashtag.decayScore * decayFactor)
      }
    }
    
    return hashtag
  })
}

export function updateHashtagUsage(
  hashtag: Hashtag,
  verified: boolean
): Hashtag {
  return {
    ...hashtag,
    usageCount: hashtag.usageCount + 1,
    verifiedUsageCount: verified ? hashtag.verifiedUsageCount + 1 : hashtag.verifiedUsageCount,
    decayScore: Math.min(100, hashtag.decayScore + (verified ? 5 : 2)),
    lastUsedAt: new Date().toISOString()
  }
}

export function createUserHashtag(
  name: string,
  category: HashtagCategory,
  vibeType: HashtagVibeType,
  userId: string
): Hashtag {
  return {
    id: `hashtag-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.replace(/[^a-zA-Z0-9]/g, ''),
    emoji: '🏷️',
    category,
    vibeType,
    seeded: false,
    usageCount: 1,
    verifiedUsageCount: 1,
    decayScore: 50,
    createdAt: new Date().toISOString(),
    createdByUserId: userId,
    lastUsedAt: new Date().toISOString()
  }
}

export function shouldPromoteUserHashtag(hashtag: Hashtag): boolean {
  if (hashtag.seeded) return false
  return hashtag.verifiedUsageCount >= 3 && hashtag.usageCount >= 5
}
