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

export async function loadPrototypeCatalog(launchedCities: string[] = []): Promise<PrototypeCatalog> {
  const [{ MOCK_VENUES }] = await Promise.all([
    import('./mock-data'),
  ])

  const launchedCitySet = normalizeLaunchedCities(launchedCities)
  const venues = MOCK_VENUES.filter((venue) => {
    if (launchedCitySet.size === 0) return true
    return launchedCitySet.has((venue.city ?? '').toLowerCase())
  })

  return {
    venues,
    pulses: [],
  }
}

export async function loadSimulatedLocation() {
  const { getSimulatedLocation } = await import('./mock-data')
  return getSimulatedLocation()
}
