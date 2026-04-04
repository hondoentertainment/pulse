/**
 * Thin wrapper around the Supabase client for data operations.
 *
 * Every helper returns the mapped application-level type so that callers
 * never deal with raw Supabase rows.  When VITE_SUPABASE_URL is not set
 * (i.e. local / demo mode), `isSupabaseConfigured()` returns false and
 * the query hooks fall back to mock data instead.
 */

import { supabase } from './supabase'
import type { Venue, Pulse, User, EnergyRating } from './types'
import type { Crew } from './crew-mode'

// ── Configuration check ───────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && !SUPABASE_URL.includes('placeholder'))
}

// ── Venues ────────────────────────────────────────────────────────────

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase.from('venues').select('*')
  if (error || !data) throw new Error(error?.message ?? 'Failed to fetch venues')

  return data.map(mapRowToVenue)
}

export async function fetchVenueById(id: string): Promise<Venue> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error(error?.message ?? `Venue ${id} not found`)

  return mapRowToVenue(data)
}

// ── Pulses ────────────────────────────────────────────────────────────

export async function fetchPulses(venueId?: string): Promise<Pulse[]> {
  let query = supabase.from('pulses').select('*')
  if (venueId) query = query.eq('venue_id', venueId)

  const { data, error } = await query
  if (error || !data) throw new Error(error?.message ?? 'Failed to fetch pulses')

  return data.map(mapRowToPulse)
}

export async function createPulse(pulse: Pulse): Promise<Pulse> {
  const { data, error } = await supabase
    .from('pulses')
    .insert({
      id: pulse.id,
      user_id: pulse.userId,
      venue_id: pulse.venueId,
      crew_id: pulse.crewId,
      photos: pulse.photos,
      video_url: pulse.video,
      energy_rating: pulse.energyRating,
      caption: pulse.caption,
      hashtags: pulse.hashtags,
      views: pulse.views,
      is_pioneer: pulse.isPioneer,
      credibility_weight: pulse.credibilityWeight,
      reactions: pulse.reactions,
      created_at: pulse.createdAt,
      expires_at: pulse.expiresAt,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create pulse')
  return mapRowToPulse(data)
}

// ── Users ─────────────────────────────────────────────────────────────

export async function fetchCurrentUser(): Promise<User> {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !authUser) throw new Error(authError?.message ?? 'Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Profile not found')

  return mapRowToUser(data)
}

export async function fetchUserProfile(id: string): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error(error?.message ?? `User ${id} not found`)

  return mapRowToUser(data)
}

// ── Social ────────────────────────────────────────────────────────────

export async function fetchCrews(userId: string): Promise<Crew[]> {
  const { data, error } = await supabase
    .from('crews')
    .select('*')
    .contains('member_ids', [userId])
  if (error || !data) throw new Error(error?.message ?? 'Failed to fetch crews')

  return data.map(mapRowToCrew)
}

export async function fetchFriends(userId: string): Promise<User[]> {
  // Fetch the user's friend ID list, then resolve profiles
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('friends')
    .eq('id', userId)
    .single()
  if (profileErr || !profile) throw new Error(profileErr?.message ?? 'Profile not found')

  const friendIds: string[] = profile.friends ?? []
  if (friendIds.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', friendIds)
  if (error || !data) throw new Error(error?.message ?? 'Failed to fetch friends')

  return data.map(mapRowToUser)
}

export async function fetchFollowing(userId: string): Promise<Venue[]> {
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('followed_venues')
    .eq('id', userId)
    .single()
  if (profileErr || !profile) throw new Error(profileErr?.message ?? 'Profile not found')

  const venueIds: string[] = profile.followed_venues ?? []
  if (venueIds.length === 0) return []

  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .in('id', venueIds)
  if (error || !data) throw new Error(error?.message ?? 'Failed to fetch followed venues')

  return data.map(mapRowToVenue)
}

// ── Row mappers ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToVenue(row: any): Venue {
  return {
    id: row.id,
    name: row.name,
    location: {
      lat: row.location_lat,
      lng: row.location_lng,
      address: row.location_address,
    },
    city: row.city,
    state: row.state,
    category: row.category,
    pulseScore: row.pulse_score ?? 0,
    scoreVelocity: row.score_velocity,
    lastPulseAt: row.last_pulse_at,
    preTrending: row.pre_trending,
    preTrendingLabel: row.pre_trending_label,
    seeded: row.seeded,
    verifiedCheckInCount: row.verified_check_in_count,
    firstRealCheckInAt: row.first_real_check_in_at,
    hours: row.hours,
    phone: row.phone,
    website: row.website,
    integrations: row.integrations,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToPulse(row: any): Pulse {
  return {
    id: row.id,
    userId: row.user_id,
    venueId: row.venue_id,
    crewId: row.crew_id,
    photos: row.photos ?? [],
    video: row.video_url,
    energyRating: row.energy_rating as EnergyRating,
    caption: row.caption,
    hashtags: row.hashtags ?? [],
    views: row.views ?? 0,
    isPioneer: row.is_pioneer,
    credibilityWeight: row.credibility_weight,
    reactions: row.reactions ?? { fire: [], eyes: [], skull: [], lightning: [] },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPending: false,
    uploadError: false,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    profilePhoto: row.profile_photo,
    friends: row.friends ?? [],
    favoriteVenues: row.favorite_venues ?? [],
    followedVenues: row.followed_venues ?? [],
    createdAt: row.created_at,
    venueCheckInHistory: row.venue_check_in_history ?? {},
    favoriteCategories: row.favorite_categories ?? [],
    credibilityScore: row.credibility_score ?? 1.0,
    presenceSettings: row.presence_settings,
    postStreak: row.post_streak,
    lastPostDate: row.last_post_date,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToCrew(row: any): Crew {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    memberIds: row.member_ids ?? [],
    createdAt: row.created_at,
    activeNight: row.active_night,
  }
}
