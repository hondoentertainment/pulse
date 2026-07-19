import { applyBoostToScore, sortWithPromotions, type VenueBoost } from './promoted-discoveries'
import type { TonightPick } from './tonight-feed'
import type { Venue } from './types'

/**
 * PRD §10 / §18 — sponsored placements must not alter organic ranking scores.
 * Organic paths rank on base scores only; sponsorship is a separate insertion layer.
 */

export function rankOrganicByScore<T extends { id: string }>(
  items: T[],
  scoreFn: (item: T) => number,
): T[] {
  return [...items].sort((a, b) => scoreFn(b) - scoreFn(a))
}

/** True when organic item order is unchanged after sponsored slot insertion. */
export function assertOrganicOrderPreserved<T extends { id: string }>(
  organicRanked: T[],
  merged: T[],
  promotedIds: Set<string>,
): boolean {
  const expected = organicRanked.filter((item) => !promotedIds.has(item.id)).map((item) => item.id)
  const actual = merged.filter((item) => !promotedIds.has(item.id)).map((item) => item.id)
  if (expected.length !== actual.length) return false
  return expected.every((id, index) => actual[index] === id)
}

/** Boost multipliers must not be consulted when computing organic Tonight order. */
export function assertBoostDoesNotAffectOrganicRanking(
  venueScores: Array<{ id: string; baseScore: number }>,
  boosts: VenueBoost[],
): boolean {
  const organicRank = rankOrganicByScore(venueScores, (v) => v.baseScore).map((v) => v.id)
  const boostedScores = venueScores.map((v) => ({
    ...v,
    boostedScore: applyBoostToScore(
      v.baseScore,
      boosts.filter((boost) => boost.venueId === v.id),
    ),
  }))
  const boostedRank = rankOrganicByScore(boostedScores, (v) => v.boostedScore).map((v) => v.id)
  return organicRank.join('|') !== boostedRank.join('|')
}

export function mergeVenuesWithSponsorship(
  organicVenues: Venue[],
  promotedVenueIds: Set<string>,
): Venue[] {
  if (promotedVenueIds.size === 0) return organicVenues
  const organicOnly = organicVenues.filter((v) => !promotedVenueIds.has(v.id))
  const sponsored = organicVenues.filter((v) => promotedVenueIds.has(v.id))
  const merged = sortWithPromotions([...organicOnly, ...sponsored], promotedVenueIds)
  if (!assertOrganicOrderPreserved(organicVenues, merged, promotedVenueIds)) {
    return organicOnly
  }
  return merged
}

/** Insert sponsored Tonight picks after organic ranking — never re-score organic picks. */
export function mergeTonightPicksWithSponsorship(
  organicPicks: TonightPick[],
  promotedVenueIds: Set<string>,
): TonightPick[] {
  if (promotedVenueIds.size === 0) {
    return organicPicks.map((pick) => ({ ...pick, isSponsored: false }))
  }

  const venues = organicPicks.map((pick) => pick.recommendation.venue)
  const mergedVenues = mergeVenuesWithSponsorship(venues, promotedVenueIds)
  const pickByVenueId = new Map(
    organicPicks.map((pick) => [pick.recommendation.venue.id, pick] as const),
  )

  return mergedVenues
    .map((venue) => {
      const pick = pickByVenueId.get(venue.id)
      if (!pick) return null
      return {
        ...pick,
        isSponsored: promotedVenueIds.has(venue.id),
      }
    })
    .filter((pick): pick is TonightPick & { isSponsored: boolean } => pick !== null)
}
