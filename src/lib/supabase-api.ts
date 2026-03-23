import { supabase } from './supabase'
import type { Venue, Pulse, EnergyRating } from './types'

export async function fetchVenuesFromSupabase(): Promise<Venue[] | null> {
  const { data, error } = await supabase.from('venues').select('*')
  if (error || !data) {
    console.error('Error fetching venues:', error)
    return null
  }
  
  return data.map(row => ({
    id: row.id,
    name: row.name,
    location: {
      lat: row.location_lat,
      lng: row.location_lng,
      address: row.location_address
    },
    city: row.city,
    state: row.state,
    category: row.category,
    pulseScore: row.pulse_score,
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
    integrations: row.integrations
  }))
}

export async function fetchPulsesFromSupabase(): Promise<Pulse[] | null> {
  const { data, error } = await supabase.from('pulses').select('*')
  if (error || !data) {
    console.error('Error fetching pulses:', error)
    return null
  }

  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    venueId: row.venue_id,
    crewId: row.crew_id,
    photos: row.photos || [],
    video: row.video_url,
    energyRating: row.energy_rating as EnergyRating,
    caption: row.caption,
    hashtags: row.hashtags || [],
    views: row.views,
    isPioneer: row.is_pioneer,
    credibilityWeight: row.credibility_weight,
    reactions: row.reactions || { fire: [], eyes: [], skull: [], lightning: [] },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPending: false,
    uploadError: false
  }))
}

export async function uploadPulseToSupabase(pulse: Pulse): Promise<boolean> {
  const { error } = await supabase.from('pulses').insert({
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
    expires_at: pulse.expiresAt
  })
  
  if (error) {
    console.error('Error uploading pulse:', error)
    return false
  }
  return true
}
