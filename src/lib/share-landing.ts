/**
 * Share deep links should paint venue energy before the full catalog arrives.
 * A missing row is "not found" only after both the catalog and the single-venue
 * lookup have settled.
 */

export function resolveShareVenueReady(input: {
  cached: boolean
  fresh: boolean
  catalogReady: boolean
  lookupSettled: boolean
}): 'pending' | 'ready' | 'missing' {
  if (input.fresh || input.cached) return 'ready'
  if (!input.catalogReady || !input.lookupSettled) return 'pending'
  return 'missing'
}
