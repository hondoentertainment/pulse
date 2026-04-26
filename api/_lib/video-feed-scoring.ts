/**
 * Composite scoring for the geo-anchored video feed.
 *
 * score = w_r * recency + w_p * pulseScore + w_d * proximity
 * where each term is normalized to [0, 1] and the weights sum to 1.
 *
 * Kept pure/stateless so it runs identically in the Edge Function and the
 * unit tests, with no I/O.
 */

export interface VideoFeedCandidate {
  id: string
  venueId: string
  createdAt: string // ISO timestamp
  pulseScore: number // 0..100 (matches `venues.pulse_score`)
  reactionCount: number
  venueLat: number
  venueLng: number
}

export interface VideoFeedScoringContext {
  now?: Date
  viewerLat?: number | null
  viewerLng?: number | null
  /** Half-life in minutes for the recency decay. Default: 45 min. */
  recencyHalfLifeMin?: number
  /** Distance (meters) past which proximity score is 0. Default: 20 km. */
  maxProximityMeters?: number
}

export interface ScoringWeights {
  recency: number
  pulseScore: number
  engagement: number
  proximity: number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  recency: 0.45,
  pulseScore: 0.25,
  engagement: 0.15,
  proximity: 0.15,
}

/**
 * Haversine distance in meters.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** 0..1 — exponential decay over time. */
export function recencyScore(createdAt: string, now: Date, halfLifeMin: number): number {
  const ageMs = now.getTime() - new Date(createdAt).getTime()
  if (ageMs < 0) return 1
  const halfLifeMs = halfLifeMin * 60_000
  return Math.max(0, Math.exp(-Math.LN2 * (ageMs / halfLifeMs)))
}

/** 0..1 — linear fallback from `maxMeters` to 0. */
export function proximityScore(distanceMeters: number, maxMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return 0
  if (distanceMeters >= maxMeters) return 0
  return 1 - distanceMeters / maxMeters
}

/** Logarithmic engagement score: more forgiving to low-engagement content. */
export function engagementScore(reactionCount: number): number {
  if (reactionCount <= 0) return 0
  // Saturates near 1 around ~50 reactions.
  return Math.min(1, Math.log10(reactionCount + 1) / Math.log10(50))
}

export interface ScoredCandidate<T extends VideoFeedCandidate = VideoFeedCandidate> {
  candidate: T
  score: number
  components: {
    recency: number
    pulseScore: number
    engagement: number
    proximity: number
  }
}

export function scoreCandidate<T extends VideoFeedCandidate>(
  candidate: T,
  ctx: VideoFeedScoringContext = {},
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredCandidate<T> {
  const now = ctx.now ?? new Date()
  const halfLifeMin = ctx.recencyHalfLifeMin ?? 45
  const maxProximity = ctx.maxProximityMeters ?? 20_000

  const recency = recencyScore(candidate.createdAt, now, halfLifeMin)
  const pulseNorm = Math.max(0, Math.min(1, candidate.pulseScore / 100))
  const engagement = engagementScore(candidate.reactionCount)

  let proximity = 0
  if (
    typeof ctx.viewerLat === 'number' &&
    typeof ctx.viewerLng === 'number' &&
    Number.isFinite(ctx.viewerLat) &&
    Number.isFinite(ctx.viewerLng)
  ) {
    const dist = haversineMeters(
      ctx.viewerLat,
      ctx.viewerLng,
      candidate.venueLat,
      candidate.venueLng,
    )
    proximity = proximityScore(dist, maxProximity)
  }

  const score =
    weights.recency * recency +
    weights.pulseScore * pulseNorm +
    weights.engagement * engagement +
    weights.proximity * proximity

  return {
    candidate,
    score,
    components: { recency, pulseScore: pulseNorm, engagement, proximity },
  }
}

export function rankCandidates<T extends VideoFeedCandidate>(
  candidates: T[],
  ctx: VideoFeedScoringContext = {},
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredCandidate<T>[] {
  return candidates
    .map((c) => scoreCandidate(c, ctx, weights))
    .sort((a, b) => b.score - a.score)
}
