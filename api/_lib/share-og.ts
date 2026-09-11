/**
 * Shared OG copy for /api/share/venue + /api/share/og.
 * Venue name + energy freshness — never invented live energy.
 */

export interface ShareOgEnergy {
  title: string
  description: string
  energyLine: string
  freshness?: string
}

const ENERGY_FROM_RATING: Record<string, string> = {
  electric: 'Electric',
  buzzing: 'Buzzing',
  chill: 'Chill',
  dead: 'Dead',
}

export function energyLabelFromScore(score: number | null | undefined): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'Live reviews on Pulse'
  if (score >= 75) return 'Electric'
  if (score >= 50) return 'Buzzing'
  if (score >= 25) return 'Chill'
  return 'Dead'
}

export function energyLabelFromRating(rating: string | null | undefined): string | null {
  if (!rating) return null
  return ENERGY_FROM_RATING[rating.toLowerCase()] ?? null
}

export function formatShareFreshness(iso: string | null | undefined, nowMs: number = Date.now()): string | undefined {
  if (!iso) return undefined
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return undefined
  const diffMins = Math.floor((nowMs - then) / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}

export function buildShareOgEnergy(input: {
  venueName?: string | null
  neighborhood?: string | null
  city?: string | null
  category?: string | null
  pulseScore?: number | null
  latestEnergyRating?: string | null
  latestCreatedAt?: string | null
  nowMs?: number
}): ShareOgEnergy {
  const title = (input.venueName ?? '').trim() || 'Pulse'
  const energy = energyLabelFromRating(input.latestEnergyRating)
    ?? energyLabelFromScore(input.pulseScore)
  const freshness = formatShareFreshness(input.latestCreatedAt, input.nowMs)
  const energyLine = freshness ? `${energy} · ${freshness}` : energy
  const place = [input.neighborhood, input.city].filter(Boolean).join(', ')
  const description = [energyLine, input.category, place]
    .filter(Boolean)
    .join(' · ')
  return {
    title,
    description: description || 'Nightlife energy on a map — live reviews from people who are there.',
    energyLine,
    freshness,
  }
}
