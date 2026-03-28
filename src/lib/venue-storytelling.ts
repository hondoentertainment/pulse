import type { Venue, User } from './types'
import { getEnergyLabel, getEnergyColor } from './pulse-engine'
import { getTimeOfDay, normalizeCategoryKeyPublic } from './time-contextual-scoring'
import type { TimeOfDay } from './time-contextual-scoring'

// ── Timelapse ───────────────────────────────────────────────────────────

export type CrowdLevel = 'empty' | 'sparse' | 'moderate' | 'packed'

export interface VenueTimelapse {
  timeOfDay: string
  energyLabel: string
  crowdLevel: CrowdLevel
  description: string
  color: string
}

interface TimeSlot {
  label: string
  hour: number
  timeOfDay: TimeOfDay
}

const TIME_SLOTS: TimeSlot[] = [
  { label: 'Morning',    hour: 9,  timeOfDay: 'morning' },
  { label: 'Afternoon',  hour: 14, timeOfDay: 'afternoon' },
  { label: 'Happy Hour', hour: 18, timeOfDay: 'evening' },
  { label: 'Evening',    hour: 21, timeOfDay: 'night' },
  { label: 'Late Night', hour: 0,  timeOfDay: 'late_night' },
]

/** Baseline expected crowd levels per normalized category per time of day */
const CATEGORY_CROWD: Record<string, Record<string, CrowdLevel>> = {
  cafe: {
    morning: 'moderate', afternoon: 'sparse', evening: 'empty',
    night: 'empty', late_night: 'empty',
  },
  restaurant: {
    morning: 'sparse', afternoon: 'moderate', evening: 'packed',
    night: 'moderate', late_night: 'empty',
  },
  bar: {
    morning: 'empty', afternoon: 'sparse', evening: 'moderate',
    night: 'packed', late_night: 'moderate',
  },
  nightclub: {
    morning: 'empty', afternoon: 'empty', evening: 'sparse',
    night: 'packed', late_night: 'packed',
  },
  music_venue: {
    morning: 'empty', afternoon: 'empty', evening: 'moderate',
    night: 'packed', late_night: 'moderate',
  },
  brewery: {
    morning: 'empty', afternoon: 'moderate', evening: 'packed',
    night: 'moderate', late_night: 'empty',
  },
  gallery: {
    morning: 'sparse', afternoon: 'moderate', evening: 'moderate',
    night: 'sparse', late_night: 'empty',
  },
}

const CROWD_SCORES: Record<CrowdLevel, number> = {
  empty: 5,
  sparse: 25,
  moderate: 55,
  packed: 85,
}

/** Category-specific descriptions for each time slot */
const DESCRIPTIONS: Record<string, Record<string, string>> = {
  cafe: {
    morning: 'Espresso machines humming, laptops open, morning regulars settling in.',
    afternoon: 'A quiet lull — perfect for a late coffee and people-watching.',
    evening: 'Winding down for the day, last drinks being poured.',
    night: 'Closed up, chairs on tables.',
    late_night: 'Dark and quiet until tomorrow.',
  },
  restaurant: {
    morning: 'Kitchen prepping, early birds trickling in for brunch.',
    afternoon: 'Lunch crowd filling up the patio seats.',
    evening: 'Prime time — every table booked, clinking glasses and laughter.',
    night: 'Late diners savoring dessert, candles flickering low.',
    late_night: 'The kitchen has closed. See you tomorrow.',
  },
  bar: {
    morning: 'Doors closed, the calm before the evening storm.',
    afternoon: 'A few day-drinkers at the bar, sports on the TVs.',
    evening: 'Happy hour in full swing — cocktails flowing, energy building.',
    night: 'Standing room only. The bartenders are in the zone.',
    late_night: 'Die-hards holding court, last call approaching.',
  },
  nightclub: {
    morning: 'Silence. The dance floor rests.',
    afternoon: 'Doors locked, sound system idle.',
    evening: 'DJs doing sound check, early arrivals grabbing spots.',
    night: 'Bass drops shaking the walls, lights cutting through fog.',
    late_night: 'Peak energy — the dance floor is a sea of movement.',
  },
  music_venue: {
    morning: 'Empty stage, roadies setting up gear.',
    afternoon: 'Sound check echoes through the empty room.',
    evening: 'Doors open, the crowd files in with anticipation.',
    night: 'The set is in full swing — crowd singing along.',
    late_night: 'Encore fading out, fans buzzing on their way out.',
  },
  brewery: {
    morning: 'Brewers tending to the tanks, taproom still closed.',
    afternoon: 'First pours of the day, flights being shared at picnic tables.',
    evening: 'Packed taproom, food trucks out front, golden hour light.',
    night: 'Winding down, last rounds being ordered.',
    late_night: 'Closed for the night.',
  },
  gallery: {
    morning: 'Curators adjusting lights, fresh installations gleaming.',
    afternoon: 'Visitors drifting through, soft conversations about the art.',
    evening: 'Opening night energy — wine, cheese, and creative buzz.',
    night: 'A quieter crowd lingers, taking in the details.',
    late_night: 'Gallery locked up, artwork resting under security lights.',
  },
}

/**
 * Generate a timelapse showing how a venue transforms through the day.
 * Returns 5 time-slot snapshots with energy, crowd level, and description.
 */
export function generateVenueTimelapse(venue: Venue): VenueTimelapse[] {
  const catKey = normalizeCategoryKeyPublic(venue.category)
  const crowdMap = CATEGORY_CROWD[catKey] ?? CATEGORY_CROWD.bar
  const descMap = DESCRIPTIONS[catKey] ?? DESCRIPTIONS.bar

  // Adjust crowd levels based on current pulse score (hot venues get busier)
  const scoreFactor = venue.pulseScore / 50 // >1 means above average

  return TIME_SLOTS.map(slot => {
    const baseCrowd = crowdMap[slot.timeOfDay] ?? crowdMap.night ?? 'sparse'
    const adjustedCrowd = adjustCrowdByScore(baseCrowd, scoreFactor)
    const score = CROWD_SCORES[adjustedCrowd]
    const energyLabel = getEnergyLabel(score)
    const color = getEnergyColor(score)
    const description = descMap[slot.timeOfDay] ?? descMap.night ?? ''

    return {
      timeOfDay: slot.label,
      energyLabel,
      crowdLevel: adjustedCrowd,
      description,
      color,
    }
  })
}

function adjustCrowdByScore(base: CrowdLevel, factor: number): CrowdLevel {
  const levels: CrowdLevel[] = ['empty', 'sparse', 'moderate', 'packed']
  const idx = levels.indexOf(base)
  if (factor > 1.5) return levels[Math.min(idx + 1, 3)]
  if (factor < 0.4) return levels[Math.max(idx - 1, 0)]
  return base
}

// ── Vibe Match ──────────────────────────────────────────────────────────

export interface VibeMatch {
  overall: number
  breakdown: {
    musicMatch: number
    crowdMatch: number
    priceMatch: number
    friendOverlap: number
  }
  verdict: string
}

interface FriendActivity {
  venueId: string
  friendIds: string[]
}

/**
 * Calculate how well a venue matches a user's vibe (0-100).
 * Uses category preferences, energy alignment, and friend overlap.
 */
export function calculateVibeMatch(
  venue: Venue,
  user: User,
  friendActivity?: FriendActivity
): VibeMatch {
  const catKey = normalizeCategoryKeyPublic(venue.category)

  // Music match: based on category preference alignment
  const favCats = (user.favoriteCategories ?? []).map(c => normalizeCategoryKeyPublic(c))
  const musicMatch = favCats.length > 0
    ? favCats.includes(catKey) ? 85 + seededRandom(venue.id, 0) * 15 : 30 + seededRandom(venue.id, 1) * 30
    : 50 + seededRandom(venue.id, 2) * 20

  // Crowd match: based on check-in history (frequent visitors like that crowd level)
  const history = user.venueCheckInHistory ?? {}
  const totalCheckins = Object.values(history).reduce((sum, n) => sum + n, 0)
  const venueCheckins = history[venue.id] ?? 0
  const crowdMatch = totalCheckins > 0
    ? Math.min(100, 40 + (venueCheckins / totalCheckins) * 200 + seededRandom(venue.id, 3) * 20)
    : 45 + seededRandom(venue.id, 4) * 25

  // Price match: derive from category (nightclubs & restaurants = $$, cafes & bars = $)
  const expensiveCats = ['nightclub', 'restaurant']
  const cheapCats = ['cafe', 'brewery']
  const userPrefsCheap = favCats.some(c => cheapCats.includes(c))
  const venueIsCheap = cheapCats.includes(catKey)
  const venueIsExpensive = expensiveCats.includes(catKey)
  let priceMatch: number
  if ((userPrefsCheap && venueIsCheap) || (!userPrefsCheap && venueIsExpensive)) {
    priceMatch = 75 + seededRandom(venue.id, 5) * 25
  } else if (favCats.length === 0) {
    priceMatch = 55 + seededRandom(venue.id, 6) * 20
  } else {
    priceMatch = 30 + seededRandom(venue.id, 7) * 25
  }

  // Friend overlap: how many friends are at this venue
  const friendIds = friendActivity?.friendIds ?? []
  const friendOverlap = friendIds.length > 0
    ? Math.min(100, friendIds.length * 25 + 20)
    : 10 + seededRandom(venue.id, 8) * 15

  const overall = Math.round(
    musicMatch * 0.3 +
    crowdMatch * 0.25 +
    priceMatch * 0.2 +
    friendOverlap * 0.25
  )

  return {
    overall: Math.min(100, Math.max(0, overall)),
    breakdown: {
      musicMatch: Math.round(musicMatch),
      crowdMatch: Math.round(crowdMatch),
      priceMatch: Math.round(priceMatch),
      friendOverlap: Math.round(friendOverlap),
    },
    verdict: getVerdict(overall),
  }
}

function getVerdict(score: number): string {
  if (score >= 85) return 'This is totally your scene'
  if (score >= 70) return 'Strong match — you\'d love it here'
  if (score >= 55) return 'Worth checking out'
  if (score >= 40) return 'Could be a fun change of pace'
  return 'Try something new!'
}

/** Deterministic pseudo-random based on venue id for consistent results */
function seededRandom(seed: string, offset: number): number {
  let hash = 0
  const s = seed + String(offset)
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash % 100) / 100
}

// ── Venue Narrative ─────────────────────────────────────────────────────

const NARRATIVE_TEMPLATES: Record<string, Record<string, string[]>> = {
  cafe: {
    morning: [
      'The aroma of fresh espresso fills the air as morning light streams in.',
      'Laptops open, conversations hum — the creative engine is running.',
    ],
    afternoon: [
      'A quiet refuge from the afternoon rush, one latte at a time.',
      'Sunlight pools on wooden tables between dog-eared books.',
    ],
    evening: [
      'Last pour of the day, golden hour light fading through the windows.',
      'The baristas wind down as the neighborhood shifts to evening mode.',
    ],
    night: ['The espresso machine sleeps. Tomorrow, it all starts again.'],
    late_night: ['Closed until first light. Dream of lattes.'],
  },
  bar: {
    morning: ['The bar stool secrets of last night have been wiped clean.'],
    afternoon: ['Afternoon pints catching the light, easy conversations.'],
    evening: [
      'Ice clinking, spirits pouring — happy hour is a state of mind.',
      'The bartender knows your name and your order. That kind of place.',
    ],
    night: [
      'Shoulder-to-shoulder energy, the crowd feeding off itself.',
      'Neon reflections in cocktail glasses, beats in the background.',
    ],
    late_night: [
      'The real ones are still here. Last call is just a suggestion.',
      'Dim lights, loud laughter, stories that won\'t be repeated.',
    ],
  },
  nightclub: {
    morning: ['The speakers are silent, but the walls still hum.'],
    afternoon: ['Doors sealed. The night hasn\'t begun yet.'],
    evening: [
      'Early birds staking out their spots, the DJ warming up.',
      'Sound check vibrations rattle through the empty dance floor.',
    ],
    night: [
      'Bass drops shaking your chest, lasers cutting through the haze.',
      'The dance floor doesn\'t care who you are. Just move.',
    ],
    late_night: [
      'Peak hour — this is what they came for.',
      'Sweat, strobe lights, and a beat that won\'t let you stop.',
    ],
  },
  restaurant: {
    morning: ['Brunch energy: mimosas popping, eggs benedicting.'],
    afternoon: ['Lunch service in full flow, aromas drifting to the street.'],
    evening: [
      'Candlelit tables, clinking glasses — the dinner rush is on.',
      'Every seat taken, every plate a story.',
    ],
    night: ['Late diners linger over wine and low conversation.'],
    late_night: ['Kitchen closed. The flavors rest until tomorrow.'],
  },
  music_venue: {
    morning: ['An empty stage is full of potential.'],
    afternoon: ['Sound check echoes, setlists taped to the floor.'],
    evening: [
      'Doors open. The anticipation is almost louder than the PA.',
      'The crowd hums with pre-show electricity.',
    ],
    night: [
      'The band is locked in, the crowd is singing back every word.',
      'Volume up, lights down — this is why live music matters.',
    ],
    late_night: [
      'Encore vibrations still ringing in your ears.',
      'Merch table stories and post-show buzzing in the parking lot.',
    ],
  },
  brewery: {
    morning: ['The tanks bubble quietly. Patience makes great beer.'],
    afternoon: [
      'First flights being poured, sun on the patio, no rush.',
      'Craft conversations and tasting notes scribbled on napkins.',
    ],
    evening: [
      'Taproom packed, food truck smoke drifting, golden hour light.',
      'Friends comparing IPAs, arguments about hops — the good kind.',
    ],
    night: ['Last rounds being pulled. Tomorrow there\'s a new batch.'],
    late_night: ['The yeast keeps working while everyone sleeps.'],
  },
  gallery: {
    morning: ['Fresh light on fresh art. The gallery breathes.'],
    afternoon: ['Visitors drift through, pausing at what moves them.'],
    evening: [
      'Opening night energy — wine, opinions, and creative sparks flying.',
      'Art and conversation compete for attention.',
    ],
    night: ['A quieter crowd studies the details others missed.'],
    late_night: ['The art watches over an empty room.'],
  },
}

/**
 * Generate a creative one-liner narrative for a venue that changes by time of day.
 */
export function generateVenueNarrative(
  venue: Venue,
  timeOfDay?: TimeOfDay,
  _pulseScore?: number
): string {
  const catKey = normalizeCategoryKeyPublic(venue.category)
  const tod = timeOfDay ?? getTimeOfDay()
  const templates = NARRATIVE_TEMPLATES[catKey] ?? NARRATIVE_TEMPLATES.bar

  // Map TimeOfDay enum to simpler key used in templates
  const todKey = tod === 'early_morning' ? 'morning' : tod

  const options = templates[todKey] ?? templates.night ?? ['The vibe speaks for itself.']

  // Pick deterministically based on venue id
  const idx = Math.abs(hashCode(venue.id)) % options.length
  return options[idx]
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

// ── Audio Vibe ──────────────────────────────────────────────────────────

export type VolumeLevel = 'quiet' | 'moderate' | 'loud' | 'thumping'

export interface AudioVibe {
  genre: string
  ambiance: string
  volumeLevel: VolumeLevel
}

const AUDIO_PROFILES: Record<string, AudioVibe[]> = {
  cafe: [
    { genre: 'Lo-fi', ambiance: 'Warm murmurs and soft acoustic tones', volumeLevel: 'quiet' },
    { genre: 'Jazz', ambiance: 'Smooth piano and gentle chatter', volumeLevel: 'quiet' },
    { genre: 'Indie', ambiance: 'Chill indie folk drifting over espresso machines', volumeLevel: 'moderate' },
  ],
  restaurant: [
    { genre: 'Jazz', ambiance: 'Candlelit ambiance with mellow saxophone', volumeLevel: 'moderate' },
    { genre: 'Classical', ambiance: 'Elegant strings beneath conversation', volumeLevel: 'quiet' },
    { genre: 'Soul', ambiance: 'Warm R&B undertones with clinking glasses', volumeLevel: 'moderate' },
  ],
  bar: [
    { genre: 'Rock', ambiance: 'Guitar riffs and rowdy conversation', volumeLevel: 'loud' },
    { genre: 'Pop', ambiance: 'Chart hits mixing with laughter and orders', volumeLevel: 'loud' },
    { genre: 'Indie', ambiance: 'Curated playlist, craft cocktail energy', volumeLevel: 'moderate' },
  ],
  nightclub: [
    { genre: 'Electronic', ambiance: 'Deep bass, strobe lights, pulsing energy', volumeLevel: 'thumping' },
    { genre: 'Hip-Hop', ambiance: 'Heavy beats, crowd moving as one', volumeLevel: 'thumping' },
    { genre: 'House', ambiance: 'Four-on-the-floor grooves, fog machines rolling', volumeLevel: 'thumping' },
  ],
  music_venue: [
    { genre: 'Rock', ambiance: 'Live amps, crowd energy, raw performance', volumeLevel: 'loud' },
    { genre: 'Jazz', ambiance: 'Intimate stage, improvisational magic', volumeLevel: 'moderate' },
    { genre: 'Electronic', ambiance: 'Synth waves washing over the audience', volumeLevel: 'loud' },
  ],
  brewery: [
    { genre: 'Indie', ambiance: 'Laid-back tunes, tasting flights, good vibes', volumeLevel: 'moderate' },
    { genre: 'Folk', ambiance: 'Acoustic strums and hoppy conversations', volumeLevel: 'moderate' },
    { genre: 'Rock', ambiance: 'Classic rock and craft beer — a perfect pairing', volumeLevel: 'loud' },
  ],
  gallery: [
    { genre: 'Ambient', ambiance: 'Ethereal soundscapes floating between installations', volumeLevel: 'quiet' },
    { genre: 'Classical', ambiance: 'Minimal compositions enhancing visual art', volumeLevel: 'quiet' },
    { genre: 'Electronic', ambiance: 'Experimental beats for an avant-garde crowd', volumeLevel: 'moderate' },
  ],
}

/**
 * Get an audio vibe description for a venue based on its category.
 * Returns genre, ambiance text, and volume level.
 */
export function getAudioVibeDescription(venue: Venue): AudioVibe {
  const catKey = normalizeCategoryKeyPublic(venue.category)
  const profiles = AUDIO_PROFILES[catKey] ?? AUDIO_PROFILES.bar
  const idx = Math.abs(hashCode(venue.id)) % profiles.length
  return profiles[idx]
}
