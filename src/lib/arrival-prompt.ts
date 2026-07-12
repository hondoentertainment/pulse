import type { EnergyRating } from './types'
import { scoreToEnergyRating } from './pulse-engine'

const STORAGE_KEY = 'pulse-pending-arrival'
const PROMPT_AFTER_MS = 20 * 60 * 1000
const PROMPT_EXPIRES_MS = 2 * 60 * 60 * 1000

export interface PendingArrival {
  venueId: string
  venueName: string
  displayedEnergy: EnergyRating
  decidedAt: number
}

function readQueue(): PendingArrival[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PendingArrival[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(items: PendingArrival[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function recordPendingArrival(input: {
  venueId: string
  venueName: string
  pulseScore: number
}): void {
  const entry: PendingArrival = {
    venueId: input.venueId,
    venueName: input.venueName,
    displayedEnergy: scoreToEnergyRating(input.pulseScore),
    decidedAt: Date.now(),
  }
  const queue = readQueue().filter((item) => item.venueId !== input.venueId)
  queue.push(entry)
  writeQueue(queue)
}

export function clearPendingArrival(venueId: string): void {
  writeQueue(readQueue().filter((item) => item.venueId !== venueId))
}

export function getDueArrivalPrompt(now: number = Date.now()): PendingArrival | null {
  const queue = readQueue()
  const due = queue.find((item) => {
    const age = now - item.decidedAt
    return age >= PROMPT_AFTER_MS && age <= PROMPT_EXPIRES_MS
  })
  if (!due) return null
  return due
}

export function pruneExpiredArrivals(now: number = Date.now()): void {
  const fresh = readQueue().filter((item) => now - item.decidedAt <= PROMPT_EXPIRES_MS)
  writeQueue(fresh)
}

export const ARRIVAL_PROMPT_AFTER_MS = PROMPT_AFTER_MS
export const ARRIVAL_PROMPT_EXPIRES_MS = PROMPT_EXPIRES_MS
