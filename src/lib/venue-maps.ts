/**
 * Maps CTA — Apple Maps on iOS, Google Maps otherwise.
 * Uses existing venue lat/lng. No Mapbox key.
 */

export const MAPS_CTA = 'Open maps'

export function isAppleMapsPlatform(
  userAgent: string | null | undefined = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): boolean {
  const ua = userAgent ?? ''
  return /iPhone|iPad|iPod/i.test(ua) || (/\bMacintosh\b/i.test(ua) && /Mobile/i.test(ua))
}

export function appleMapsHref(input: {
  lat: number
  lng: number
  name?: string
}): string {
  const params = new URLSearchParams({
    ll: `${input.lat},${input.lng}`,
    q: input.name?.trim() || `${input.lat},${input.lng}`,
  })
  return `https://maps.apple.com/?${params.toString()}`
}

export function googleMapsHref(input: {
  lat: number
  lng: number
  name?: string
}): string {
  const query = input.name?.trim()
    ? `${input.name} ${input.lat},${input.lng}`
    : `${input.lat},${input.lng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function venueMapsHref(input: {
  lat: number
  lng: number
  name?: string
  userAgent?: string | null
}): string {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return ''
  return isAppleMapsPlatform(input.userAgent)
    ? appleMapsHref(input)
    : googleMapsHref(input)
}
