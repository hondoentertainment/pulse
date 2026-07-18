/**
 * Personalized dashboard — per-user history that steers tonight’s choices.
 *
 * Builds visit patterns from check-ins + pulses, then surfaces actionable
 * choice guides (return, explore, vibe, time) for the current person.
 */

import type { EnergyRating, Pulse, User, Venue } from './types'
import { buildCategoryPreferences } from './venue-recommendations'
import { getPersonalizedVenues } from './personalization-engine'
import { normalizeCategoryKeyPublic } from './time-contextual-scoring'

export type ChoiceGuideKind = 'return' | 'explore' | 'vibe' | 'time' | 'fresh' | 'taste'

export interface HistoryEntry {
  venueId: string
  venueName: string
  category: string
  visitCount: number
  lastVisitAt: string | null
  lastEnergy: EnergyRating | null
  pulseScore: number
}

export interface ChoiceGuide {
  id: string
  kind: ChoiceGuideKind
  title: string
  reason: string
  venueId?: string
  venueName?: string
  suggestedVibe?: EnergyRating
  cta: 'tonight' | 'venue' | 'discover'
}

export interface PersonalDashboardSummary {
  totalVisits: number
  uniqueVenues: number
  topCategories: { category: string; share: number; label: string }[]
  preferredEnergy: EnergyRating | null
  peakHourLabel: string | null
  goToVenues: HistoryEntry[]
}

export interface PersonalDashboard {
  userId: string
  username: string
  summary: PersonalDashboardSummary
  history: HistoryEntry[]
  choiceGuides: ChoiceGuide[]
  suggestedVibe: EnergyRating | null
  empty: boolean
}

const ENERGY_ORDER: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

function hourLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'mornings'
  if (hour >= 12 && hour < 17) return 'afternoons'
  if (hour >= 17 && hour < 22) return 'evenings'
  return 'late nights'
}

function formatCategory(key: string): string {
  if (!key) return 'nightlife'
  return key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function dominantEnergy(pulses: Pulse[]): EnergyRating | null {
  if (pulses.length === 0) return null
  const counts: Record<EnergyRating, number> = { dead: 0, chill: 0, buzzing: 0, electric: 0 }
  for (const p of pulses) counts[p.energyRating]++
  return ENERGY_ORDER.reduce((best, e) => (counts[e] > counts[best] ? e : best), 'chill')
}

function peakHour(pulses: Pulse[]): number | null {
  if (pulses.length === 0) return null
  const buckets: Record<number, number> = {}
  for (const p of pulses) {
    const h = new Date(p.createdAt).getHours()
    buckets[h] = (buckets[h] ?? 0) + 1
  }
  return Number(Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? NaN)
}

/**
 * Merge check-in counts with pulse timestamps into a per-venue history list.
 */
export function buildVisitHistory(
  user: User,
  venues: Venue[],
  pulses: Pulse[],
): HistoryEntry[] {
  const venueMap = new Map(venues.map((v) => [v.id, v]))
  const history = user.venueCheckInHistory ?? {}
  const userPulses = pulses.filter((p) => p.userId === user.id)
  const venueIds = new Set([...Object.keys(history), ...userPulses.map((p) => p.venueId)])

  const entries: HistoryEntry[] = []
  for (const venueId of venueIds) {
    const venue = venueMap.get(venueId)
    if (!venue) continue
    const venuePulses = userPulses
      .filter((p) => p.venueId === venueId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const checkIns = history[venueId] ?? 0
    const visitCount = Math.max(checkIns, venuePulses.length)
    const latest = venuePulses[0]
    entries.push({
      venueId,
      venueName: venue.name,
      category: normalizeCategoryKeyPublic(venue.category),
      visitCount,
      lastVisitAt: latest?.createdAt ?? null,
      lastEnergy: latest?.energyRating ?? null,
      pulseScore: venue.pulseScore,
    })
  }

  return entries.sort((a, b) => {
    if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount
    const at = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0
    const bt = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0
    return bt - at
  })
}

function buildChoiceGuides(
  user: User,
  venues: Venue[],
  pulses: Pulse[],
  history: HistoryEntry[],
  preferredEnergy: EnergyRating | null,
  peak: number | null,
  now: Date,
): ChoiceGuide[] {
  const guides: ChoiceGuide[] = []
  const visited = new Set(history.map((h) => h.venueId))
  const prefs = buildCategoryPreferences(user, venues)
  const topCat = Object.entries(prefs).sort((a, b) => b[1] - a[1])[0]?.[0]
  const hour = now.getHours()

  // 1. Return to a live go-to
  const goToLive = history
    .filter((h) => h.visitCount >= 2 && h.pulseScore >= 55)
    .sort((a, b) => b.pulseScore - a.pulseScore)[0]
  if (goToLive) {
    guides.push({
      id: `return-${goToLive.venueId}`,
      kind: 'return',
      title: `Back to ${goToLive.venueName}?`,
      reason: `You've been ${goToLive.visitCount}× — it's scoring ${goToLive.pulseScore} right now.`,
      venueId: goToLive.venueId,
      venueName: goToLive.venueName,
      cta: 'venue',
    })
  }

  // 2. Explore similar but unvisited
  if (topCat) {
    const fresh = venues
      .filter((v) => {
        const key = normalizeCategoryKeyPublic(v.category)
        return key === topCat && !visited.has(v.id) && v.pulseScore >= 50
      })
      .sort((a, b) => b.pulseScore - a.pulseScore)[0]
    if (fresh) {
      guides.push({
        id: `explore-${fresh.id}`,
        kind: 'explore',
        title: `Try ${fresh.name}`,
        reason: `Same ${formatCategory(topCat)} vibe as your usual spots — new for you.`,
        venueId: fresh.id,
        venueName: fresh.name,
        cta: 'venue',
      })
    }
  }

  // 3. Suggested vibe from history
  if (preferredEnergy && preferredEnergy !== 'dead') {
    guides.push({
      id: `vibe-${preferredEnergy}`,
      kind: 'vibe',
      title: `Lean ${preferredEnergy} tonight`,
      reason: 'That’s the energy you report most often — Tonight is tuned for it.',
      suggestedVibe: preferredEnergy,
      cta: 'tonight',
    })
  }

  // 4. Time-of-day alignment — carry preferred vibe into Tonight deep-link
  if (peak !== null && Math.abs(peak - hour) <= 2) {
    guides.push({
      id: `time-${peak}`,
      kind: 'time',
      title: `This is your ${hourLabel(peak)} window`,
      reason: 'Your history says you’re usually out around now — good time to decide.',
      suggestedVibe: preferredEnergy ?? undefined,
      cta: 'tonight',
    })
  } else if (peak !== null) {
    guides.push({
      id: `time-shift-${peak}`,
      kind: 'time',
      title: `You usually go out ${hourLabel(peak)}`,
      reason: 'Browse picks now, or wait for your usual window.',
      suggestedVibe: preferredEnergy ?? undefined,
      cta: 'discover',
    })
  }

  // 5. Taste from onboarding when history is thin
  const favCats = user.favoriteCategories ?? []
  if (history.length < 2 && favCats.length > 0) {
    const cat = favCats[0]
    const favKey = normalizeCategoryKeyPublic(cat)
    const match = venues
      .filter((v) => {
        const key = normalizeCategoryKeyPublic(v.category)
        const raw = (v.category ?? '').toLowerCase()
        const fc = cat.toLowerCase()
        const matches =
          key === favKey ||
          key.includes(fc) ||
          fc.includes(key) ||
          raw.includes(fc) ||
          fc.includes(raw)
        return matches && v.pulseScore >= 45
      })
      .sort((a, b) => b.pulseScore - a.pulseScore)[0]
    if (match) {
      guides.push({
        id: `taste-${match.id}`,
        kind: 'taste',
        title: `Start with ${match.name}`,
        reason: `Matches your taste in ${formatCategory(cat)}.`,
        venueId: match.id,
        venueName: match.name,
        cta: 'venue',
      })
    }
  }

  // 6. Personalized engine top pick as “fresh” when not already covered
  const scored = getPersonalizedVenues({
    user,
    venues,
    pulses,
    userLocation: null,
    currentTime: now,
  })
  const top = scored.find((s) => !guides.some((g) => g.venueId === s.venue.id))
  if (top && guides.length < 5) {
    guides.push({
      id: `fresh-${top.venue.id}`,
      kind: 'fresh',
      title: top.venue.name,
      reason: top.reasons[0] ?? 'Personalized for you from your history.',
      venueId: top.venue.id,
      venueName: top.venue.name,
      cta: 'venue',
    })
  }

  return guides.slice(0, 5)
}

export function buildPersonalDashboard(
  user: User,
  venues: Venue[],
  pulses: Pulse[],
  now: Date = new Date(),
): PersonalDashboard {
  const userPulses = pulses.filter((p) => p.userId === user.id)
  const history = buildVisitHistory(user, venues, userPulses)
  const prefs = buildCategoryPreferences(user, venues)
  const topCategories = Object.entries(prefs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, share]) => ({
      category,
      share,
      label: formatCategory(category),
    }))

  // Blend onboarding favorites when check-in prefs are empty
  if (topCategories.length === 0 && (user.favoriteCategories?.length ?? 0) > 0) {
    for (const cat of user.favoriteCategories!.slice(0, 3)) {
      topCategories.push({
        category: normalizeCategoryKeyPublic(cat),
        share: 1 / user.favoriteCategories!.length,
        label: formatCategory(cat),
      })
    }
  }

  const preferredEnergy = dominantEnergy(userPulses)
  const peak = peakHour(userPulses)
  const totalVisits = history.reduce((sum, h) => sum + h.visitCount, 0)
  const goToVenues = history.filter((h) => h.visitCount >= 2).slice(0, 5)

  const empty = history.length === 0 && userPulses.length === 0

  return {
    userId: user.id,
    username: user.username,
    summary: {
      totalVisits,
      uniqueVenues: history.length,
      topCategories,
      preferredEnergy,
      peakHourLabel: peak !== null ? hourLabel(peak) : null,
      goToVenues,
    },
    history: history.slice(0, 20),
    choiceGuides: buildChoiceGuides(
      user,
      venues,
      pulses,
      history,
      preferredEnergy,
      peak,
      now,
    ),
    suggestedVibe: preferredEnergy,
    empty,
  }
}
