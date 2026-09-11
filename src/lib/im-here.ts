/**
 * “I'm here · open map” deep-link helpers.
 *
 * `/?here=:venueId` focuses the home map on that pin.
 * Signed-in users also start the create path; guests can view the pin
 * and hit `/auth` only when they try to write.
 */

import { getCreatePulseAuthRedirect } from './guest-discovery'

export const HERE_QUERY_PARAM = 'here'
export const CREATE_QUERY_PARAM = 'create'

export function parseHereVenueId(
  search: string | { get(name: string): string | null },
): string | null {
  const value = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(HERE_QUERY_PARAM)
    : search.get(HERE_QUERY_PARAM)
  const venueId = value?.trim()
  return venueId ? venueId : null
}

export function wantsImHereCreate(
  search: string | { get(name: string): string | null },
): boolean {
  const value = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(CREATE_QUERY_PARAM)
    : search.get(CREATE_QUERY_PARAM)
  return value === '1' || value === 'true'
}

export function getImHereMapPath(
  venueId: string,
  options: { create?: boolean } = {},
): string {
  const params = new URLSearchParams()
  params.set(HERE_QUERY_PARAM, venueId)
  if (options.create) params.set(CREATE_QUERY_PARAM, '1')
  return `/?${params.toString()}`
}

export function resolveImHereAction(input: {
  venueId: string
  isPlaceholder: boolean
  hasSession: boolean
}): {
  mapPath: string
  openCreate: boolean
  authRedirect: string | null
} {
  const authRedirect = getCreatePulseAuthRedirect({
    isPlaceholder: input.isPlaceholder,
    hasSession: input.hasSession,
  })
  return {
    mapPath: getImHereMapPath(input.venueId),
    openCreate: authRedirect === null,
    authRedirect,
  }
}
