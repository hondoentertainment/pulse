import type { Pulse, User, Venue, EnergyRating } from './types'
import { calculateDistance } from './pulse-engine'

/** Phase 6.2 — Personal Insights Dashboard */

export type VibeType = 'Night Owl' | 'Explorer' | 'Trendsetter' | 'Chill Seeker' | 'Energy Magnet' | 'Social Butterfly'

export interface WeeklyInsights {
  userId: string; weekStart: string; venuesVisited: number; uniqueVenues: number
  totalPulses: number; energyContributed: Record<EnergyRating, number>
  milesExplored: number; topVenue?: string; mostActiveDay: number
}

export interface ActivityHeatmap { userId: string; cells: { dayOfWeek: number; hour: number; count: number }[] }

export interface YearInReview {
  userId: string; year: number; totalPulses: number; uniqueVenues: number
  topVenues: { venueId: string; venueName: string; count: number }[]
  dominantVibeType: VibeType; monthlyActivity: Record<number, number>
  longestStreak: number; totalMilesExplored: number; favoriteCategory: string
  energyBreakdown: Record<EnergyRating, number>
}

export function generateWeeklyInsights(userId: string, pulses: Pulse[], venues: Venue[], weekStart: string): WeeklyInsights {
  const start = new Date(weekStart).getTime()
  const end = start + 7 * 24 * 60 * 60 * 1000
  const wp = pulses.filter(p => p.userId === userId && new Date(p.createdAt).getTime() >= start && new Date(p.createdAt).getTime() < end)
  const venueIds = wp.map(p => p.venueId)
  const unique = new Set(venueIds)
  const energy: Record<EnergyRating, number> = { dead: 0, chill: 0, buzzing: 0, electric: 0 }
  const dayCounts: Record<number, number> = {}
  for (const p of wp) { energy[p.energyRating]++; const d = new Date(p.createdAt).getDay(); dayCounts[d] = (dayCounts[d] ?? 0) + 1 }
  const mostActiveDay = Object.entries(dayCounts).sort(([,a],[,b]) => b - a)[0]?.[0] ?? '0'
  const venueCounts: Record<string, number> = {}
  for (const id of venueIds) venueCounts[id] = (venueCounts[id] ?? 0) + 1
  const topVenueId = Object.entries(venueCounts).sort(([,a],[,b]) => b - a)[0]?.[0]
  const topVenue = venues.find(v => v.id === topVenueId)?.name
  return {
    userId, weekStart, venuesVisited: venueIds.length, uniqueVenues: unique.size,
    totalPulses: wp.length, energyContributed: energy,
    milesExplored: calculateMilesExplored(wp, venues), topVenue,
    mostActiveDay: Number(mostActiveDay),
  }
}

export function determineVibeType(pulses: Pulse[], user: User): { type: VibeType; description: string; emoji: string } {
  const nightCount = pulses.filter(p => { const h = new Date(p.createdAt).getHours(); return h >= 22 || h < 4 }).length
  const uniqueVenues = new Set(pulses.map(p => p.venueId)).size
  const electricCount = pulses.filter(p => p.energyRating === 'electric').length
  const chillCount = pulses.filter(p => p.energyRating === 'chill').length
  const friendCount = user.friends.length

  if (nightCount > pulses.length * 0.5 && pulses.length > 0) return { type: 'Night Owl', description: 'You come alive after dark', emoji: '🦉' }
  if (uniqueVenues >= 10) return { type: 'Explorer', description: 'Always discovering new spots', emoji: '🗺️' }
  if (electricCount > pulses.length * 0.4 && pulses.length > 0) return { type: 'Energy Magnet', description: 'You find the energy everywhere', emoji: '⚡' }
  if (friendCount >= 8) return { type: 'Social Butterfly', description: 'Connected to everyone', emoji: '🦋' }
  if (chillCount > pulses.length * 0.4 && pulses.length > 0) return { type: 'Chill Seeker', description: 'You know the best low-key spots', emoji: '😌' }
  return { type: 'Trendsetter', description: 'Always ahead of the curve', emoji: '📈' }
}

export function generateActivityHeatmap(userId: string, pulses: Pulse[]): ActivityHeatmap {
  const userPulses = pulses.filter(p => p.userId === userId)
  const grid: Record<string, number> = {}
  for (const p of userPulses) {
    const d = new Date(p.createdAt)
    const key = `${d.getDay()}-${d.getHours()}`
    grid[key] = (grid[key] ?? 0) + 1
  }
  return { userId, cells: Object.entries(grid).map(([k, count]) => { const [dow, hour] = k.split('-').map(Number); return { dayOfWeek: dow, hour, count } }) }
}

export function generateYearInReview(userId: string, year: number, pulses: Pulse[], venues: Venue[], user: User): YearInReview {
  const yearPulses = pulses.filter(p => p.userId === userId && new Date(p.createdAt).getFullYear() === year)
  const venueMap = new Map(venues.map(v => [v.id, v]))
  const venueCounts: Record<string, number> = {}
  const energy: Record<EnergyRating, number> = { dead: 0, chill: 0, buzzing: 0, electric: 0 }
  const monthly: Record<number, number> = {}
  for (const p of yearPulses) {
    venueCounts[p.venueId] = (venueCounts[p.venueId] ?? 0) + 1
    energy[p.energyRating]++
    const m = new Date(p.createdAt).getMonth(); monthly[m] = (monthly[m] ?? 0) + 1
  }
  const topVenues = Object.entries(venueCounts).sort(([,a],[,b]) => b - a).slice(0, 5)
    .map(([id, count]) => ({ venueId: id, venueName: venueMap.get(id)?.name ?? 'Unknown', count }))
  const categories: Record<string, number> = {}
  for (const id of Object.keys(venueCounts)) { const cat = venueMap.get(id)?.category ?? 'Other'; categories[cat] = (categories[cat] ?? 0) + venueCounts[id] }
  return {
    userId, year, totalPulses: yearPulses.length, uniqueVenues: new Set(yearPulses.map(p => p.venueId)).size,
    topVenues, dominantVibeType: determineVibeType(yearPulses, user).type,
    monthlyActivity: monthly, longestStreak: calcStreak(yearPulses),
    totalMilesExplored: calculateMilesExplored(yearPulses, venues),
    favoriteCategory: Object.entries(categories).sort(([,a],[,b]) => b - a)[0]?.[0] ?? 'Other',
    energyBreakdown: energy,
  }
}

export function calculateMilesExplored(pulses: Pulse[], venues: Venue[]): number {
  const venueMap = new Map(venues.map(v => [v.id, v]))
  const sorted = [...pulses].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  let total = 0
  for (let i = 1; i < sorted.length; i++) {
    const a = venueMap.get(sorted[i - 1].venueId), b = venueMap.get(sorted[i].venueId)
    if (a && b && a.id !== b.id) total += calculateDistance(a.location.lat, a.location.lng, b.location.lat, b.location.lng)
  }
  return Math.round(total * 100) / 100
}

export function getInsightHighlights(insights: WeeklyInsights): string[] {
  const h: string[] = []
  if (insights.uniqueVenues > 0) h.push(`You visited ${insights.uniqueVenues} unique venue${insights.uniqueVenues > 1 ? 's' : ''} this week`)
  if (insights.totalPulses > 0) h.push(`You posted ${insights.totalPulses} pulse${insights.totalPulses > 1 ? 's' : ''}`)
  if (insights.topVenue) h.push(`Your top spot was ${insights.topVenue}`)
  return h.slice(0, 3)
}

function calcStreak(pulses: Pulse[]): number {
  if (!pulses.length) return 0
  const days = [...new Set(pulses.map(p => new Date(p.createdAt).toISOString().split('T')[0]))].sort()
  let max = 1, cur = 1
  for (let i = 1; i < days.length; i++) {
    if (Math.round((new Date(days[i]).getTime() - new Date(days[i-1]).getTime()) / 86400000) === 1) { cur++; max = Math.max(max, cur) } else cur = 1
  }
  return max
}
