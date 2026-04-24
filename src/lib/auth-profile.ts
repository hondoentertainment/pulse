import type { SupabaseClient, User as AuthUser } from '@supabase/supabase-js'
import type { User as PulseUser } from './types'

export interface ProfileRow {
  id: string
  username: string
  profile_photo_url: string | null
  friends: string[] | null
  favorite_venues: string[] | null
  followed_venues: string[] | null
  favorite_categories: string[] | null
  credibility_score: number | null
  presence_settings: PulseUser['presenceSettings'] | null
  venue_check_in_history: PulseUser['venueCheckInHistory'] | null
  post_streak: number | null
  last_post_date: string | null
  created_at: string
}

function sanitizeUsernamePart(value: string | undefined): string {
  const sanitized = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return sanitized || 'pulse_user'
}

export function deriveUsername(authUser: AuthUser): string {
  const metadata = authUser.user_metadata ?? {}
  const emailPrefix = authUser.email?.split('@')[0]
  const base =
    typeof metadata.username === 'string' ? metadata.username :
    typeof metadata.user_name === 'string' ? metadata.user_name :
    typeof metadata.preferred_username === 'string' ? metadata.preferred_username :
    typeof metadata.name === 'string' ? metadata.name :
    emailPrefix

  const uniqueSuffix = authUser.id.replace(/-/g, '').slice(0, 6).toLowerCase()
  return `${sanitizeUsernamePart(base)}_${uniqueSuffix}`
}

export function createFallbackProfile(authUser: AuthUser): PulseUser {
  const seed = authUser.email ?? authUser.id
  const metadata = authUser.user_metadata ?? {}
  const metadataAvatar =
    typeof metadata.avatar_url === 'string' ? metadata.avatar_url :
    typeof metadata.picture === 'string' ? metadata.picture :
    undefined

  return {
    id: authUser.id,
    username: deriveUsername(authUser),
    profilePhoto: metadataAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`,
    friends: [],
    favoriteVenues: [],
    followedVenues: [],
    createdAt: new Date().toISOString(),
    venueCheckInHistory: {},
    favoriteCategories: [],
    credibilityScore: 1.0,
    presenceSettings: {
      enabled: true,
      visibility: 'everyone',
      hideAtSensitiveVenues: false,
    },
    postStreak: 0,
  }
}

export function mapProfileRowToPulseUser(row: ProfileRow): PulseUser {
  return {
    id: row.id,
    username: row.username,
    profilePhoto: row.profile_photo_url || undefined,
    friends: row.friends || [],
    favoriteVenues: row.favorite_venues || [],
    followedVenues: row.followed_venues || [],
    createdAt: row.created_at,
    venueCheckInHistory: row.venue_check_in_history || {},
    favoriteCategories: row.favorite_categories || [],
    credibilityScore: row.credibility_score ?? 1.0,
    presenceSettings: row.presence_settings || {
      enabled: true,
      visibility: 'everyone',
      hideAtSensitiveVenues: false,
    },
    postStreak: row.post_streak ?? 0,
    lastPostDate: row.last_post_date || undefined,
  }
}

export async function fetchOrCreateProfile(
  client: Pick<SupabaseClient, 'from'>,
  authUser: AuthUser
): Promise<PulseUser> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data) {
    return mapProfileRowToPulseUser(data as ProfileRow)
  }

  const fallbackProfile = createFallbackProfile(authUser)
  const insertPayload = {
    id: fallbackProfile.id,
    username: fallbackProfile.username,
    profile_photo_url: fallbackProfile.profilePhoto ?? null,
    friends: fallbackProfile.friends,
    favorite_venues: fallbackProfile.favoriteVenues ?? [],
    followed_venues: fallbackProfile.followedVenues ?? [],
    favorite_categories: fallbackProfile.favoriteCategories ?? [],
    credibility_score: fallbackProfile.credibilityScore ?? 1.0,
    presence_settings: fallbackProfile.presenceSettings,
    venue_check_in_history: fallbackProfile.venueCheckInHistory ?? {},
    post_streak: fallbackProfile.postStreak ?? 0,
    last_post_date: fallbackProfile.lastPostDate ?? null,
    created_at: fallbackProfile.createdAt,
  }

  const { data: inserted, error: insertError } = await client
    .from('profiles')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertError) {
    console.error('Error creating profile:', insertError)
    return fallbackProfile
  }

  return mapProfileRowToPulseUser(inserted as ProfileRow)
}
