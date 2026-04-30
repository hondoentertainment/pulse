import { supabase } from './supabase'
import type { Venue, Pulse, EnergyRating, ReactionType, VenueLiveSummary } from './types'
import type { LiveReport } from './live-intelligence'

type VenueLiveReportRow = {
  id: string
  venue_id: string
  user_id: string
  type: LiveReport['type']
  value: unknown
  created_at: string
}

type VenueLiveAggregateRow = {
  venue_id: string
  report_count: number | null
  wait_time: number | null
  cover_charge: number | null
  cover_charge_note: string | null
  crowd_level: number | null
  dress_code: string | null
  music_genre: string | null
  now_playing: { track?: string; artist?: string } | null
  confidence: Record<string, 'low' | 'medium' | 'high'> | null
  last_report_at: string | null
  updated_at: string
}

type LiveVenueIntelligenceRow = {
  id: string
  name: string
  location_lat: number
  location_lng: number
  location_address: string
  city: string | null
  state: string | null
  category: string | null
  pulse_score: number | null
  score_velocity: number | null
  last_pulse_at: string | null
  pre_trending: boolean | null
  pre_trending_label: string | null
  seeded: boolean | null
  verified_check_in_count: number | null
  first_real_check_in_at: string | null
  hours: Venue['hours'] | null
  phone: string | null
  website: string | null
  integrations: Venue['integrations'] | null
  live_summary: VenueLiveAggregateRow | null
  latest_activity_at: string | null
}

function getJoinedLiveAggregate(value: unknown): VenueLiveAggregateRow | null {
  if (Array.isArray(value)) return (value[0] as VenueLiveAggregateRow | undefined) ?? null
  return value ? value as VenueLiveAggregateRow : null
}

function mapVenueRow(row: {
  id: string
  name: string
  location_lat: number
  location_lng: number
  location_address: string
  city?: string | null
  state?: string | null
  category?: string | null
  pulse_score?: number | null
  score_velocity?: number | null
  last_pulse_at?: string | null
  pre_trending?: boolean | null
  pre_trending_label?: string | null
  seeded?: boolean | null
  verified_check_in_count?: number | null
  first_real_check_in_at?: string | null
  hours?: Venue['hours'] | null
  phone?: string | null
  website?: string | null
  integrations?: Venue['integrations'] | null
  latest_activity_at?: string | null
}, liveAggregate: VenueLiveAggregateRow | null): Venue {
  return {
    id: row.id,
    name: row.name,
    location: {
      lat: row.location_lat,
      lng: row.location_lng,
      address: row.location_address
    },
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    category: row.category ?? undefined,
    pulseScore: row.pulse_score ?? 0,
    scoreVelocity: row.score_velocity ?? 0,
    lastPulseAt: row.last_pulse_at ?? undefined,
    lastActivity: row.latest_activity_at ?? row.last_pulse_at ?? undefined,
    preTrending: row.pre_trending ?? false,
    preTrendingLabel: row.pre_trending_label ?? undefined,
    seeded: row.seeded ?? false,
    verifiedCheckInCount: row.verified_check_in_count ?? 0,
    firstRealCheckInAt: row.first_real_check_in_at ?? undefined,
    hours: row.hours ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    integrations: row.integrations ?? undefined,
    liveSummary: liveAggregate ? mapVenueLiveAggregate(liveAggregate) : undefined
  }
}

export async function fetchVenuesFromSupabase(): Promise<Venue[] | null> {
  const { data: intelligenceData, error: intelligenceError } = await supabase
    .rpc('get_live_venue_intelligence', { max_pulses: 1000 })

  if (!intelligenceError && Array.isArray(intelligenceData)) {
    return (intelligenceData as LiveVenueIntelligenceRow[]).map(row =>
      mapVenueRow(row, row.live_summary)
    )
  }

  const { data, error } = await supabase
    .from('venues')
    .select('*, venue_live_aggregates(*)')
    .order('pulse_score', { ascending: false })
  if (error || !data) {
    console.error('Error fetching venues:', error)
    return null
  }
  
  return data.map(row => {
    const liveAggregate = getJoinedLiveAggregate(row.venue_live_aggregates)
    return mapVenueRow(row, liveAggregate)
  })
}

export async function fetchPulsesFromSupabase(): Promise<Pulse[] | null> {
  const { data, error } = await supabase
    .from('pulses')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1000)
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

export function mapVenueLiveReport(row: VenueLiveReportRow): LiveReport {
  return {
    id: row.id,
    venueId: row.venue_id,
    userId: row.user_id,
    type: row.type,
    value: row.value,
    createdAt: row.created_at,
  }
}

export function mapVenueLiveAggregate(row: VenueLiveAggregateRow): VenueLiveSummary {
  return {
    reportCount: row.report_count ?? 0,
    waitTime: row.wait_time,
    coverCharge: row.cover_charge,
    coverChargeNote: row.cover_charge_note ?? undefined,
    crowdLevel: row.crowd_level ?? 0,
    dressCode: row.dress_code,
    musicGenre: row.music_genre,
    nowPlaying: row.now_playing?.track && row.now_playing?.artist
      ? { track: row.now_playing.track, artist: row.now_playing.artist }
      : null,
    confidence: row.confidence ?? {},
    lastReportAt: row.last_report_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchVenueLiveReportsFromSupabase(venueId: string): Promise<LiveReport[] | null> {
  const { data, error } = await supabase
    .from('venue_live_reports')
    .select('*')
    .eq('venue_id', venueId)
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('Error fetching venue live reports:', error)
    return null
  }

  return (data as VenueLiveReportRow[]).map(mapVenueLiveReport)
}

export async function submitVenueLiveReportToSupabase(report: LiveReport): Promise<LiveReport | null> {
  const { data, error } = await supabase
    .from('venue_live_reports')
    .insert({
      venue_id: report.venueId,
      user_id: report.userId,
      type: report.type,
      value: report.value,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('Error submitting venue live report:', error)
    return null
  }

  return mapVenueLiveReport(data as VenueLiveReportRow)
}

export async function fetchVenueLiveAggregateFromSupabase(venueId: string): Promise<VenueLiveSummary | null> {
  const { data, error } = await supabase
    .from('venue_live_aggregates')
    .select('*')
    .eq('venue_id', venueId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching venue live aggregate:', error)
    return null
  }

  return data ? mapVenueLiveAggregate(data as VenueLiveAggregateRow) : null
}

export async function togglePulseReactionInSupabase(
  pulseId: string,
  reactionType: ReactionType
): Promise<Pulse['reactions'] | null> {
  const { data, error } = await supabase.rpc('toggle_pulse_reaction', {
    target_pulse_id: pulseId,
    target_reaction_type: reactionType,
  })

  if (error || !data) {
    console.error('Error toggling pulse reaction:', error)
    return null
  }

  return data as Pulse['reactions']
}
