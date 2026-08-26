/**
 * Geo launch allowlist for venue discovery.
 *
 * `VITE_LAUNCHED_CITIES` accepts city+state pairs so a value like
 * `Seattle,WA` is one market, not two tokens. Multiple markets are
 * separated by `;` or `|`.
 *
 * Empty / unset = no geo-gate (all catalog venues stay visible).
 */

export interface LaunchedMarket {
  city: string
  state?: string
  label: string
}

const STATE_RE = /^[a-z]{2}$/i

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\./g, '')
}

function titleCaseCity(city: string): string {
  return city
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function parseLaunchedCities(raw: string | undefined | null): LaunchedMarket[] {
  if (!raw) return []

  const chunks = raw
    .split(/[;|]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  const markets: LaunchedMarket[] = []

  for (const chunk of chunks) {
    const parts = chunk.split(',').map((part) => part.trim()).filter(Boolean)
    if (parts.length === 0) continue

    if (parts.length >= 2 && STATE_RE.test(parts[parts.length - 1])) {
      const state = parts[parts.length - 1].toUpperCase()
      const city = parts.slice(0, -1).join(' ')
      markets.push({
        city,
        state,
        label: `${titleCaseCity(city)},${state}`,
      })
      continue
    }

    markets.push({
      city: parts.join(' '),
      label: titleCaseCity(parts.join(' ')),
    })
  }

  return markets
}

export function getLaunchedMarketsFromEnv(
  raw: string | undefined | null = import.meta.env.VITE_LAUNCHED_CITIES,
): LaunchedMarket[] {
  return parseLaunchedCities(raw)
}

export function isGeoGateEnabled(markets: LaunchedMarket[] = getLaunchedMarketsFromEnv()): boolean {
  return markets.length > 0
}

export function matchesLaunchedMarket(
  venue: { city?: string | null; state?: string | null },
  markets: LaunchedMarket[],
): boolean {
  if (markets.length === 0) return true

  const city = normalizeToken(venue.city ?? '')
  const state = normalizeToken(venue.state ?? '')
  if (!city) return false

  return markets.some((market) => {
    const marketCity = normalizeToken(market.city)
    if (city !== marketCity) return false
    if (!market.state) return true
    return !state || state === normalizeToken(market.state)
  })
}

export function filterVenuesByLaunchedMarkets<T extends { city?: string | null; state?: string | null }>(
  venues: T[],
  markets: LaunchedMarket[],
): T[] {
  if (markets.length === 0) return venues
  return venues.filter((venue) => matchesLaunchedMarket(venue, markets))
}

export function isPointInLaunchedMarket(
  nearestCityName: string | null | undefined,
  markets: LaunchedMarket[],
): boolean {
  if (markets.length === 0) return true
  if (!nearestCityName) return false

  const [city, state] = nearestCityName.split(',').map((part) => part.trim())
  return matchesLaunchedMarket({ city, state }, markets)
}
