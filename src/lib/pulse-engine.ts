import { Pulse, Venue, ENERGY_CONFIG, PULSE_DECAY_MINUTES } from './types'

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export function isWithinRadius(
  userLat: number,
  userLng: number,
  venueLat: number,
  venueLng: number,
  radiusMiles: number
): boolean {
  const distance = calculateDistance(userLat, userLng, venueLat, venueLng)
  return distance <= radiusMiles
}

export function calculatePulseScore(pulses: Pulse[], useCredibilityWeighting: boolean = true): number {
  const now = new Date().getTime()
  const decayMs = PULSE_DECAY_MINUTES * 60 * 1000

  let totalScore = 0
  let validPulses = 0

  pulses.forEach((pulse) => {
    const pulseTime = new Date(pulse.createdAt).getTime()
    const age = now - pulseTime

    if (age > decayMs) return

    const recencyFactor = 1 - age / decayMs
    const energyValue = ENERGY_CONFIG[pulse.energyRating].value
    const engagementFactor =
      1 + (pulse.reactions.fire.length * 0.5 +
        pulse.reactions.lightning.length * 0.5 +
        pulse.reactions.eyes.length * 0.2 +
        pulse.views * 0.1) / 100

    const credibilityWeight = useCredibilityWeighting && pulse.credibilityWeight
      ? pulse.credibilityWeight
      : 1.0

    totalScore += energyValue * recencyFactor * engagementFactor * credibilityWeight * 25
    validPulses++
  })

  if (validPulses === 0) return 0

  const velocityBonus = validPulses > 5 ? validPulses * 5 : 0
  return Math.min(100, Math.round(totalScore + velocityBonus))
}

export function getEnergyLabel(score: number): string {
  if (score >= 75) return 'Electric'
  if (score >= 50) return 'Buzzing'
  if (score >= 25) return 'Chill'
  return 'Dead'
}

export function getEnergyColor(score: number): string {
  if (score >= 75) return ENERGY_CONFIG.electric.color
  if (score >= 50) return ENERGY_CONFIG.buzzing.color
  if (score >= 25) return ENERGY_CONFIG.chill.color
  return ENERGY_CONFIG.dead.color
}

export function formatTimeAgo(dateString: string): string {
  const now = new Date().getTime()
  const past = new Date(dateString).getTime()
  const diffMs = now - past
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}

export function canPostPulse(
  venueId: string,
  lastPulses: Pulse[],
  cooldownMinutes: number
): { canPost: boolean; remainingMinutes?: number } {
  const venuePulses = lastPulses.filter((p) => p.venueId === venueId)
  if (venuePulses.length === 0) return { canPost: true }

  const lastPulse = venuePulses.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]

  const now = new Date().getTime()
  const lastPulseTime = new Date(lastPulse.createdAt).getTime()
  const diffMs = now - lastPulseTime
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins >= cooldownMinutes) {
    return { canPost: true }
  }

  return {
    canPost: false,
    remainingMinutes: cooldownMinutes - diffMins
  }
}

export function getVenuesByProximity(
  venues: Venue[],
  userLat: number,
  userLng: number
): Venue[] {
  return venues
    .map((venue) => ({
      ...venue,
      distance: calculateDistance(
        userLat,
        userLng,
        venue.location.lat,
        venue.location.lng
      )
    }))
    .sort((a, b) => a.distance - b.distance)
}
