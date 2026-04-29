import type { Pulse, Venue } from './types'

export interface PrototypeCatalog {
  venues: Venue[]
  pulses: Pulse[]
}

function normalizeLaunchedCities(launchedCities: string[]): Set<string> {
  return new Set(
    launchedCities
      .map((city) => city.trim().toLowerCase())
      .filter(Boolean)
  )
}

function buildPreviewPulses(venues: Venue[]): Pulse[] {
  const now = Date.now()
  const previewUsers = ['user-2', 'user-3', 'user-4', 'user-5', 'user-6']
  const photos = [
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=1500&fit=crop',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&h=1500&fit=crop',
    'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&h=1500&fit=crop',
    'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=1200&h=1500&fit=crop',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=1500&fit=crop',
  ]

  return venues.slice(0, 10).flatMap((venue, index) => {
    const createdAt = new Date(now - (index + 1) * 4 * 60 * 1000).toISOString()
    return [{
      id: `preview-pulse-${venue.id}`,
      userId: previewUsers[index % previewUsers.length],
      venueId: venue.id,
      photos: [photos[index % photos.length]],
      energyRating: index % 3 === 0 ? 'electric' : index % 3 === 1 ? 'buzzing' : 'chill',
      caption: index % 2 === 0 ? 'Packed room, fast line, great set.' : 'Strong crowd and the vibe is still climbing.',
      hashtags: ['live', 'tonight', venue.category?.toLowerCase().replace(/\s+/g, '') ?? 'venue'],
      views: 90 + index * 17,
      reactions: {
        fire: ['user-2', 'user-3'].slice(0, (index % 2) + 1),
        eyes: ['user-4'],
        skull: [],
        lightning: ['user-5'],
      },
      credibilityWeight: 1,
      createdAt,
      expiresAt: new Date(now + 90 * 60 * 1000).toISOString(),
    } satisfies Pulse]
  })
}

export async function loadPrototypeCatalog(launchedCities: string[] = []): Promise<PrototypeCatalog> {
  const [{ MOCK_VENUES }] = await Promise.all([
    import('./mock-data'),
  ])

  const launchedCitySet = normalizeLaunchedCities(launchedCities)
  const filteredVenues = MOCK_VENUES.filter((venue) => {
    if (launchedCitySet.size === 0) return true
    return launchedCitySet.has((venue.city ?? '').toLowerCase())
  })
  const venues = filteredVenues.length > 0 ? filteredVenues : MOCK_VENUES

  return {
    venues,
    pulses: import.meta.env.VITE_VISUAL_PREVIEW === 'true' ? buildPreviewPulses(venues) : [],
  }
}

export async function loadSimulatedLocation() {
  const { getSimulatedLocation } = await import('./mock-data')
  return getSimulatedLocation()
}
