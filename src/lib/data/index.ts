/**
 * Barrel for the data layer. Components should import from `@/lib/data`
 * rather than reaching into individual modules — keeps future refactors
 * (e.g. splitting venues into `venues/read.ts` + `venues/write.ts`) local.
 */

export * as VenueData from './venues'
export * as PulseData from './pulses'
export * as ReactionData from './reactions'
export * as CheckInData from './check-ins'
export * as FollowData from './follows'
export * as NotificationData from './notifications'

export { USE_SUPABASE_BACKEND, warnIfUsingMockBackend } from './config'
