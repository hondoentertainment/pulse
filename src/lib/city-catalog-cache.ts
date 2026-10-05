import type { QueryClient } from '@tanstack/react-query'
import type { Venue } from './types'

export const CITY_CATALOG_QUERY_KEY = ['city-catalog'] as const

interface CityCatalogCache {
  venues: Venue[]
}

/** Write live venue fields onto the per-city catalog the map actually reads. */
export function patchCityCatalogVenues(
  client: Pick<QueryClient, 'setQueriesData'>,
  updater: (venues: Venue[]) => Venue[],
): void {
  client.setQueriesData<CityCatalogCache>(
    { queryKey: CITY_CATALOG_QUERY_KEY },
    (current) => {
      if (!current) return current
      const venues = updater(current.venues)
      if (venues === current.venues) return current
      return { ...current, venues }
    },
  )
}
